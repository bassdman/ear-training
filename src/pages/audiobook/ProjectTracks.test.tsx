import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as audioStorage from './audioStorage'
import { ProjectTracks } from './ProjectTracks'

vi.mock('./AudioTimeline', () => ({
  AudioTimeline: ({ tracks, onMixChange }: {
    tracks: audioStorage.AudioTrack[]
    onMixChange: (id: string, patch: Partial<audioStorage.TrackMix>) => void
  }) => (
    <div>{tracks.map((track) => (
      <div key={track.id}>
        <span>{track.name}</span>
        <button onClick={() => onMixChange(track.id, { volume: 0.3 })}>Lautstärke {track.name}</button>
        <button onClick={() => onMixChange(track.id, { muted: true })}>Mute {track.name}</button>
      </div>
    ))}</div>
  ),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ProjectTracks', () => {
  it('speichert mehrere Spuren, stellt sie nach erneutem Öffnen wieder her und gibt sie zur Wiedergabe frei', async () => {
    const projectId = crypto.randomUUID()
    const view = render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    const first = new File(['first'], 'gesang.mp3', { type: 'audio/mpeg' })
    fireEvent.change(input, { target: { files: [first] } })
    expect(await screen.findByText('gesang.mp3')).toBeInTheDocument()

    const second = new File(['second'], 'klavier.wav', { type: 'audio/wav' })
    fireEvent.change(screen.getByLabelText('Neues Audio hinzufügen'), { target: { files: [second] } })
    expect(await screen.findByText('klavier.wav')).toBeInTheDocument()
    expect(screen.getByText('Spur 3')).toBeInTheDocument()
    view.unmount()
    render(<ProjectTracks projectId={projectId} />)
    expect(await screen.findByText('gesang.mp3')).toBeInTheDocument()
    expect(screen.getByText('klavier.wav')).toBeInTheDocument()
    expect((await audioStorage.readTracks(projectId)).map((track) => track.name).sort()).toEqual(['gesang.mp3', 'klavier.wav'])
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('trennt und löscht Audiodaten je Projekt', async () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    await audioStorage.addTrack(firstId, new File(['a'], 'a.mp3', { type: 'audio/mpeg' }))
    await audioStorage.addTrack(secondId, new File(['b'], 'b.mp3', { type: 'audio/mpeg' }))
    await audioStorage.deleteProjectTracks(firstId)
    expect(await audioStorage.readTracks(firstId)).toEqual([])
    expect(await audioStorage.readTracks(secondId)).toHaveLength(1)
    await audioStorage.deleteProjectTracks(secondId)
  })

  it('speichert schnell aufeinanderfolgende Spureinstellungen dauerhaft', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addTrack(projectId, new File(['a'], 'mix.mp3', { type: 'audio/mpeg' }))
    const view = render(<ProjectTracks projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Lautstärke mix.mp3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute mix.mp3' }))
    await waitFor(async () => {
      expect(audioStorage.getTrackMix((await audioStorage.readTracks(projectId))[0])).toEqual({ volume: 0.3, muted: true })
    })
    view.unmount()
    expect(audioStorage.getTrackMix((await audioStorage.readTracks(projectId))[0])).toEqual({ volume: 0.3, muted: true })
    expect(audioStorage.getTrackMix({ ...track, volume: undefined, muted: undefined })).toEqual({ volume: 1, muted: false })
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Speicherfehler bei Spureinstellungen', async () => {
    const projectId = crypto.randomUUID()
    await audioStorage.addTrack(projectId, new File(['a'], 'mix.mp3', { type: 'audio/mpeg' }))
    vi.spyOn(audioStorage, 'updateTrackMix').mockRejectedValue(new Error('Speicherfehler'))
    render(<ProjectTracks projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mute mix.mp3' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden')
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Speicherfehler und zeigt keine ungespeicherte Spur', async () => {
    vi.spyOn(audioStorage, 'addTrack').mockRejectedValue(new Error('Speicher voll'))
    render(<ProjectTracks projectId={crypto.randomUUID()} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    fireEvent.change(input, { target: { files: [new File(['a'], 'test.mp3', { type: 'audio/mpeg' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden')
    expect(screen.queryByText('test.mp3')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Neues Audio hinzufügen')).toBeEnabled()
  })

  it('weist leere und ungeeignete Dateien ab', async () => {
    const projectId = crypto.randomUUID()
    render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    fireEvent.change(input, { target: { files: [new File([], 'leer.mp3', { type: 'audio/mpeg' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('ist leer')
    fireEvent.change(input, { target: { files: [new File(['text'], 'text.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Audiodatei')
    fireEvent.change(input, { target: { files: [new File(['a'], 'ton.mp3', { type: 'audio/mpeg' })] } })
    await screen.findByText('ton.mp3')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('lässt die Dateiauswahl ungefiltert und akzeptiert Audio trotz abweichendem MIME-Typ', async () => {
    const projectId = crypto.randomUUID()
    render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    expect(input).not.toHaveAttribute('accept')

    const files = [
      new File(['a'], 'Sprachmemo.M4A', { type: 'video/mp4' }),
      new File(['b'], 'aufnahme.wav', { type: 'application/octet-stream' }),
      new File(['c'], 'titel.mp3'),
    ]
    for (const file of files) {
      fireEvent.change(input, { target: { files: [file] } })
      expect(await screen.findByText(file.name)).toBeInTheDocument()
      await waitFor(() => expect(input).toBeEnabled())
    }

    expect((await audioStorage.readTracks(projectId)).map((track) => track.name).sort()).toEqual(
      files.map((file) => file.name).sort(),
    )
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Fehler beim Laden', async () => {
    vi.spyOn(audioStorage, 'readTracks').mockRejectedValue(new Error('Datenbankfehler'))
    render(<ProjectTracks projectId={crypto.randomUUID()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen werden')
    expect(screen.queryByLabelText('Neues Audio hinzufügen')).not.toBeInTheDocument()
  })
})
