import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as audioStorage from './audioStorage'
import { ProjectTracks } from './ProjectTracks'

vi.mock('./waveform', () => ({
  decodeWaveform: vi.fn().mockResolvedValue({ waveform: { duration: 10 } }),
}))

vi.mock('./AudioTimeline', () => ({
  AudioTimeline: ({ tracks, onMixChange, onImport }: {
    tracks: audioStorage.AudioTrack[]
    onMixChange: (id: string, patch: Partial<audioStorage.TrackMix>) => void
    onImport: (id: string, start: number, durations: Record<string, number>, file: File) => void
  }) => (
    <div>{tracks.map((track) => (
      <div key={track.id}>
        <span>{track.name || 'Leere Spur'}</span>
        {audioStorage.getTrackClips(track).map((clip) => <span key={clip.id}>{clip.name}</span>)}
        <button onClick={() => onMixChange(track.id, { volume: 0.3 })}>Lautstärke {track.name}</button>
        <button onClick={() => onMixChange(track.id, { muted: true })}>Mute {track.name}</button>
        <input aria-label={`Import ${track.id}`} type="file" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImport(track.id, 12, Object.fromEntries(audioStorage.getTrackClips(track).map((clip) => [clip.id, clip.duration ?? 10])), file)
        }} />
      </div>
    ))}</div>
  ),
}))

afterEach(() => vi.restoreAllMocks())

describe('ProjectTracks', () => {
  it('legt eine leere Spur an und speichert importierte Blöcke mit Position', async () => {
    const projectId = crypto.randomUUID()
    const view = render(<ProjectTracks projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: /Spur hinzufügen/ }))
    expect(await screen.findByText('Leere Spur')).toBeInTheDocument()
    const [track] = await audioStorage.readTracks(projectId)
    const input = screen.getByLabelText(`Import ${track.id}`)
    expect(input).not.toHaveAttribute('accept')
    fireEvent.change(input, { target: { files: [new File(['a'], 'Sprachmemo.M4A', { type: 'video/mp4' })] } })
    expect(await screen.findByText('Sprachmemo.M4A')).toBeInTheDocument()
    const [saved] = await audioStorage.readTracks(projectId)
    expect(audioStorage.getTrackClips(saved)[0]).toMatchObject({ name: 'Sprachmemo.M4A', start: 12, duration: 10 })
    view.unmount()
    render(<ProjectTracks projectId={projectId} />)
    expect(await screen.findByText('Sprachmemo.M4A')).toBeInTheDocument()
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('verhindert überlappende Blöcke und erhält bestehende Daten', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addEmptyTrack(projectId)
    await audioStorage.addClip(track.id, { id: 'existing', name: 'alt.mp3', audio: new Blob(['a']), start: 10, duration: 10 })
    render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText(`Import ${track.id}`)
    fireEvent.change(input, { target: { files: [new File(['a'], 'neu.mp3', { type: 'audio/mpeg' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('überlappen')
    expect(audioStorage.getTrackClips((await audioStorage.readTracks(projectId))[0])).toHaveLength(1)
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('erhält alte Projekte und speichert Mischereinstellungen', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addTrack(projectId, new File(['a'], 'alt.mp3', { type: 'audio/mpeg' }))
    render(<ProjectTracks projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Lautstärke alt.mp3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute alt.mp3' }))
    await waitFor(async () => expect(audioStorage.getTrackMix((await audioStorage.readTracks(projectId))[0])).toEqual({ volume: 0.3, muted: true }))
    expect(audioStorage.getTrackClips((await audioStorage.readTracks(projectId))[0])[0]).toMatchObject({ name: 'alt.mp3', start: 0 })
    expect(audioStorage.getTrackMix({ ...track, volume: undefined, muted: undefined })).toEqual({ volume: 1, muted: false })
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('bewahrt alte Audiospuren beim Ergänzen weiterer Blöcke', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addTrack(projectId, new File(['alt'], 'alt.mp3', { type: 'audio/mpeg' }))
    const oldClip = audioStorage.getTrackClips(track)[0]
    await audioStorage.addClip(track.id, { id: 'new', name: 'neu.mp3', audio: new Blob(['neu']), start: 10, duration: 5 }, { [oldClip.id]: 10 })
    const clips = audioStorage.getTrackClips((await audioStorage.readTracks(projectId))[0])
    expect(clips.map(({ name, start }) => ({ name, start }))).toEqual([
      { name: 'alt.mp3', start: 0 }, { name: 'neu.mp3', start: 10 },
    ])
    await expect(audioStorage.addClip(track.id, { id: 'overlap', name: 'overlap', audio: new Blob(['a']), start: 11, duration: 2 }, { [oldClip.id]: 10 })).rejects.toThrow('überlappt')
    expect(audioStorage.getTrackClips((await audioStorage.readTracks(projectId))[0])).toHaveLength(2)
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Speicher- und Validierungsfehler', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addEmptyTrack(projectId)
    render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText(`Import ${track.id}`)
    fireEvent.change(input, { target: { files: [new File([], 'leer.mp3', { type: 'audio/mpeg' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('ist leer')
    fireEvent.change(input, { target: { files: [new File(['a'], 'datei.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Audiodatei')
    vi.spyOn(audioStorage, 'addClip').mockRejectedValue(new Error('Speicher voll'))
    fireEvent.change(input, { target: { files: [new File(['a'], 'ton.mp3', { type: 'audio/mpeg' })] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('konnte nicht importiert werden'))
    expect(audioStorage.getTrackClips((await audioStorage.readTracks(projectId))[0])).toHaveLength(0)
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Fehler beim Laden', async () => {
    vi.spyOn(audioStorage, 'readTracks').mockRejectedValue(new Error('Datenbankfehler'))
    render(<ProjectTracks projectId={crypto.randomUUID()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen werden')
  })
})
