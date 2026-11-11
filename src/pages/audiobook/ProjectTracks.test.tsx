import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as audioStorage from './audioStorage'
import { ProjectTracks } from './ProjectTracks'

vi.mock('./waveform', () => ({
  decodeWaveform: vi.fn().mockResolvedValue({ waveform: { duration: 10 } }),
}))

vi.mock('./AudioTimeline', () => ({
  AudioTimeline: ({ tracks, onMixChange, onImport, onPaste, onDelete, onDeleteTrack }: {
    tracks: audioStorage.AudioTrack[]
    onMixChange: (id: string, patch: Partial<audioStorage.TrackMix>) => void
    onImport: (id: string, start: number, durations: Record<string, number>, file: File) => void
    onPaste: (id: string, start: number, durations: Record<string, number>, clip: audioStorage.AudioClip) => void
    onDelete: (trackId: string, clipId: string) => void
    onDeleteTrack: (trackId: string) => void
  }) => (
    <div>{tracks.map((track) => (
      <div key={track.id}>
        <span>{track.name || 'Leere Spur'}</span>
        {audioStorage.getTrackClips(track).map((clip) => <span key={clip.id}>{clip.name}<button onClick={() => onDelete(track.id, clip.id)}>Lösche {clip.name}</button></span>)}
        <button onClick={() => onMixChange(track.id, { volume: 0.3 })}>Lautstärke {track.name}</button>
        <button onClick={() => onMixChange(track.id, { muted: true })}>Mute {track.name}</button>
        <button onClick={() => onDeleteTrack(track.id)}>Spur löschen {track.id}</button>
        <button onClick={() => {
          const clip = tracks.flatMap(audioStorage.getTrackClips)[0]
          if (clip) onPaste(track.id, 12, Object.fromEntries(tracks.flatMap(audioStorage.getTrackClips).map((item) => [item.id, item.duration ?? 10])), { ...clip, duration: clip.duration ?? 10 })
        }}>Einfügen {track.id}</button>
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
    fireEvent.click(await screen.findByRole('button', { name: 'Mixed-Spur' }))
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

  it('legt alle drei Spurarten an und erhält sie beim erneuten Öffnen', async () => {
    const projectId = crypto.randomUUID()
    const view = render(<ProjectTracks projectId={projectId} />)
    for (const [label, type] of [
      ['Vocalspur', 'vocal'],
      ['Instrumentalspur', 'instrumental'],
      ['Mixed-Spur', 'mixed'],
    ] as const) {
      fireEvent.click(await screen.findByRole('button', { name: label }))
      await waitFor(async () => expect((await audioStorage.readTracks(projectId)).some((track) => track.type === type)).toBe(true))
    }
    const tracks = await audioStorage.readTracks(projectId)
    expect(tracks.map((track) => track.type).sort()).toEqual(['instrumental', 'mixed', 'vocal'])
    view.unmount()
    render(<ProjectTracks projectId={projectId} />)
    await waitFor(() => expect(screen.getAllByText('Leere Spur')).toHaveLength(3))
    expect((await audioStorage.readTracks(projectId)).map((track) => track.type).sort()).toEqual(['instrumental', 'mixed', 'vocal'])
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

  it('fügt dauerhaft in andere Spuren ein und meldet Überlappungen', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addEmptyTrack(projectId)
    const target = await audioStorage.addEmptyTrack(projectId)
    await audioStorage.addClip(source.id, { id: crypto.randomUUID(), name: 'sample.wav', audio: new Blob(['audio']), start: 0, duration: 5, sourceStart: 3 })
    const view = render(<ProjectTracks projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: `Einfügen ${target.id}` }))
    await waitFor(async () => expect(audioStorage.getTrackClips((await audioStorage.readTracks(projectId)).find((track) => track.id === target.id)!)).toHaveLength(1))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lösche sample.wav' })).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: `Einfügen ${target.id}` }))
    expect(await screen.findByRole('alert')).toHaveTextContent('überlappt')
    view.unmount()
    render(<ProjectTracks projectId={projectId} />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lösche sample.wav' })).toHaveLength(2))
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('erhält alte Projekte und speichert Mischereinstellungen', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addTrack(projectId, new File(['a'], 'alt.mp3', { type: 'audio/mpeg' }))
    expect(track.type).toBeUndefined()
    expect((await audioStorage.readTracks(projectId))[0].type).toBe('mixed')
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

  it('verschiebt alte und neue Blöcke atomar zwischen Spuren und verhindert Überlappungen', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addTrack(projectId, new File(['alt'], 'alt.mp3', { type: 'audio/mpeg' }))
    const target = await audioStorage.addEmptyTrack(projectId)
    await audioStorage.addClip(target.id, { id: 'existing', name: 'vorhanden.mp3', audio: new Blob(['a']), start: 20, duration: 5 })
    const id = `${source.id}:legacy`
    await expect(audioStorage.moveClip(source.id, target.id, id, 15, { [id]: 10 })).rejects.toThrow('überlappt')
    let rows = await audioStorage.readTracks(projectId)
    expect(audioStorage.getTrackClips(rows.find((t) => t.id === source.id)!)).toHaveLength(1)
    await audioStorage.moveClip(source.id, target.id, id, 5, { [id]: 10 })
    rows = await audioStorage.readTracks(projectId)
    expect(audioStorage.getTrackClips(rows.find((t) => t.id === source.id)!)).toHaveLength(0)
    expect(rows.find((t) => t.id === source.id)?.audio).toBeUndefined()
    const moved = audioStorage.getTrackClips(rows.find((t) => t.id === target.id)!).find((clip) => clip.id === id)
    expect(moved).toMatchObject({ name: 'alt.mp3', start: 5, duration: 10 })
    await audioStorage.moveClip(target.id, target.id, id, 10, {})
    rows = await audioStorage.readTracks(projectId)
    expect(audioStorage.getTrackClips(rows.find((t) => t.id === target.id)!).find((clip) => clip.id === id)?.start).toBe(10)
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('schneidet ohne Audiodaten zu duplizieren und erhält Quellbereiche beim Verschieben und Löschen', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addTrack(projectId, new File(['audio'], 'alt.wav', { type: 'audio/wav' }))
    const target = await audioStorage.addEmptyTrack(projectId)
    const id = `${source.id}:legacy`
    await expect(audioStorage.splitClip(source.id, id, 0, 10)).rejects.toThrow('Schnittposition')
    await expect(audioStorage.splitClip(source.id, id, 10, 10)).rejects.toThrow('Schnittposition')
    await audioStorage.splitClip(source.id, id, 4, 10)
    let rows = await audioStorage.readTracks(projectId)
    let clips = audioStorage.getTrackClips(rows.find((t) => t.id === source.id)!)
    expect(clips).toHaveLength(2)
    expect(clips[0]).toMatchObject({ start: 0, duration: 4 })
    expect(clips[1]).toMatchObject({ start: 4, sourceStart: 4, duration: 6, audioId: clips[0].audioId })
    expect(clips[0].audio).toBe(clips[1].audio)
    const secondId = clips[1].id
    await audioStorage.moveClip(source.id, target.id, secondId, 20, {})
    await audioStorage.splitClip(target.id, secondId, 22, 6)
    rows = await audioStorage.readTracks(projectId)
    clips = audioStorage.getTrackClips(rows.find((t) => t.id === target.id)!)
    expect(clips.map(({ start, sourceStart, duration }) => ({ start, sourceStart, duration }))).toEqual([
      { start: 20, sourceStart: 4, duration: 2 },
      { start: 22, sourceStart: 6, duration: 4 },
    ])
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ear-training-audiobook', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const readRaw = () => new Promise<{ tracks: { clips: { audio?: Blob, audioId?: string }[] }[], audio: { projectId: string }[] }>((resolve, reject) => {
      const tx = db.transaction(['tracks', 'audio'], 'readonly')
      const trackRequest = tx.objectStore('tracks').index('projectId').getAll(projectId)
      const audioRequest = tx.objectStore('audio').getAll()
      tx.oncomplete = () => resolve({ tracks: trackRequest.result, audio: audioRequest.result.filter((item: { projectId: string }) => item.projectId === projectId) })
      tx.onabort = () => reject(tx.error)
    })
    const raw = await readRaw()
    expect(raw.audio).toHaveLength(1)
    expect(raw.tracks.flatMap((track) => track.clips).every((clip) => !clip.audio && clip.audioId)).toBe(true)
    await audioStorage.deleteProjectTracks(projectId)
    expect((await readRaw()).audio).toHaveLength(0)
    db.close()
  })

  it('speichert Kopien als gemeinsame Audioreferenzen und bewahrt die Zwischenablage nach dem Löschen', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addTrack(projectId, new File(['audio'], 'alt.wav'))
    const target = await audioStorage.addEmptyTrack(projectId)
    const copied = { ...audioStorage.getTrackClips(source)[0], duration: 10, sourceStart: 2, audioId: crypto.randomUUID() }
    await audioStorage.pasteClip(projectId, target.id, copied, 5, {})
    await audioStorage.pasteClip(projectId, target.id, copied, 15, {})
    await audioStorage.pasteClip(projectId, source.id, copied, 10, { [copied.id]: 10 })
    await expect(audioStorage.pasteClip(projectId, target.id, copied, 14, {})).rejects.toThrow('überlappt')
    let rows = await audioStorage.readTracks(projectId)
    const original = audioStorage.getTrackClips(rows.find((track) => track.id === source.id)!)[0]
    let copies = audioStorage.getTrackClips(rows.find((track) => track.id === target.id)!)
    expect(copies).toHaveLength(2)
    expect(copies[0]).toMatchObject({ start: 5, duration: 10, sourceStart: 2, audioId: original.audioId })
    expect(copies[0].audio).toBe(original.audio)
    expect(copies[0].id).not.toBe(original.id)
    const sameTrackCopy = audioStorage.getTrackClips(rows.find((track) => track.id === source.id)!)[1]
    expect(sameTrackCopy).toMatchObject({ start: 10, duration: 10, audioId: original.audioId })
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ear-training-audiobook', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const raw = await new Promise<{ tracks: { clips: { audio?: Blob, audioId?: string }[] }[], audio: { projectId: string }[] }>((resolve, reject) => {
      const tx = db.transaction(['tracks', 'audio'], 'readonly')
      const tracks = tx.objectStore('tracks').index('projectId').getAll(projectId)
      const audio = tx.objectStore('audio').getAll()
      tx.oncomplete = () => resolve({ tracks: tracks.result, audio: audio.result.filter((item: { projectId: string }) => item.projectId === projectId) })
      tx.onabort = () => reject(tx.error)
    })
    expect(raw.audio).toHaveLength(1)
    expect(raw.tracks.flatMap((track) => track.clips).every((clip) => !clip.audio && clip.audioId === original.audioId)).toBe(true)
    db.close()
    await audioStorage.deleteTrack(source.id)
    await audioStorage.deleteTrack(target.id)
    const newTarget = await audioStorage.addEmptyTrack(projectId)
    await audioStorage.pasteClip(projectId, newTarget.id, copied, 0, {})
    rows = await audioStorage.readTracks(projectId)
    copies = audioStorage.getTrackClips(rows[0])
    expect(copies[0]).toMatchObject({ start: 0, duration: 10, sourceStart: 2, audioId: copied.audioId })
    expect(copies[0].audio).toBeTruthy()
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('löscht einzelne geteilte Blöcke transaktional und entfernt die Audiodatei erst beim letzten Verweis', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addTrack(projectId, new File(['audio'], 'alt.wav'))
    const target = await audioStorage.addEmptyTrack(projectId)
    const legacyId = `${source.id}:legacy`
    await audioStorage.splitClip(source.id, legacyId, 4, 10)
    const [first, second] = audioStorage.getTrackClips((await audioStorage.readTracks(projectId)).find((track) => track.id === source.id)!)
    await audioStorage.moveClip(source.id, target.id, second.id, 4, {})
    await audioStorage.deleteClip(source.id, first.id)
    let rows = await audioStorage.readTracks(projectId)
    expect(audioStorage.getTrackClips(rows.find((track) => track.id === source.id)!)).toHaveLength(0)
    expect(audioStorage.getTrackClips(rows.find((track) => track.id === target.id)!)[0]).toMatchObject({ id: second.id, sourceStart: 4, duration: 6 })

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ear-training-audiobook', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const audioExists = () => new Promise<boolean>((resolve, reject) => {
      const request = db.transaction('audio').objectStore('audio').get(first.audioId!)
      request.onsuccess = () => resolve(request.result !== undefined)
      request.onerror = () => reject(request.error)
    })
    expect(await audioExists()).toBe(true)
    await expect(audioStorage.deleteClip(target.id, 'missing')).rejects.toThrow('nicht gefunden')
    expect(await audioExists()).toBe(true)
    await audioStorage.deleteClip(target.id, second.id)
    expect(await audioExists()).toBe(false)
    rows = await audioStorage.readTracks(projectId)
    expect(rows.flatMap(audioStorage.getTrackClips)).toHaveLength(0)
    db.close()
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('löscht Spuren samt Clips und erhält gemeinsam genutztes Audio bis zur letzten Spur', async () => {
    const projectId = crypto.randomUUID()
    const source = await audioStorage.addTrack(projectId, new File(['audio'], 'alt.wav'))
    const target = await audioStorage.addEmptyTrack(projectId, 'vocal')
    const legacyId = `${source.id}:legacy`
    await audioStorage.splitClip(source.id, legacyId, 4, 10)
    const [first, second] = audioStorage.getTrackClips((await audioStorage.readTracks(projectId)).find((track) => track.id === source.id)!)
    await audioStorage.moveClip(source.id, target.id, second.id, 4, {})
    await audioStorage.deleteTrack(source.id)
    const remaining = await audioStorage.readTracks(projectId)
    expect(remaining).toHaveLength(1)
    expect(audioStorage.getTrackClips(remaining[0])[0]).toMatchObject({ id: second.id, audioId: first.audioId, sourceStart: 4 })
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ear-training-audiobook', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const audioExists = () => new Promise<boolean>((resolve, reject) => {
      const request = db.transaction('audio').objectStore('audio').get(first.audioId!)
      request.onsuccess = () => resolve(request.result !== undefined)
      request.onerror = () => reject(request.error)
    })
    expect(await audioExists()).toBe(true)
    await audioStorage.deleteTrack(target.id)
    expect(await audioExists()).toBe(false)
    await expect(audioStorage.deleteTrack(target.id)).rejects.toThrow('Spur nicht gefunden')
    expect(await audioStorage.readTracks(projectId)).toHaveLength(0)
    db.close()
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Fehler beim Spurlöschen und entfernt sie nach erfolgreichem Speichern', async () => {
    const projectId = crypto.randomUUID()
    const track = await audioStorage.addEmptyTrack(projectId)
    const view = render(<ProjectTracks projectId={projectId} />)
    const button = await screen.findByRole('button', { name: `Spur löschen ${track.id}` })
    const failure = vi.spyOn(audioStorage, 'deleteTrack').mockRejectedValueOnce(new Error('Speicherfehler'))
    fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Spur konnte nicht gelöscht werden')
    expect(await audioStorage.readTracks(projectId)).toHaveLength(1)
    failure.mockRestore()
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('button', { name: `Spur löschen ${track.id}` })).not.toBeInTheDocument())
    view.unmount()
    render(<ProjectTracks projectId={projectId} />)
    expect(await screen.findByRole('button', { name: 'Mixed-Spur' })).toBeInTheDocument()
    expect(await audioStorage.readTracks(projectId)).toHaveLength(0)
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('entfernt eine Spur mit mehreren eingebetteten Clips, ohne andere Projekte zu verändern', async () => {
    const projectId = crypto.randomUUID()
    const otherProject = crypto.randomUUID()
    const track = await audioStorage.addEmptyTrack(projectId)
    const other = await audioStorage.addTrack(otherProject, new File(['other'], 'andere.wav'))
    await audioStorage.addClip(track.id, { id: 'first', name: 'a.wav', audio: new Blob(['a']), start: 0, duration: 5 })
    await audioStorage.addClip(track.id, { id: 'second', name: 'b.wav', audio: new Blob(['b']), start: 5, duration: 5 })
    await audioStorage.deleteTrack(track.id)
    expect(await audioStorage.readTracks(projectId)).toHaveLength(0)
    const [remaining] = await audioStorage.readTracks(otherProject)
    expect(remaining.id).toBe(other.id)
    expect(audioStorage.getTrackClips(remaining)).toHaveLength(1)
    await audioStorage.deleteProjectTracks(otherProject)
  })

  it('löscht Legacy- und eingebettete Blöcke dauerhaft und meldet Speicherfehler', async () => {
    const projectId = crypto.randomUUID()
    const legacy = await audioStorage.addTrack(projectId, new File(['alt'], 'alt.wav'))
    const inline = await audioStorage.addEmptyTrack(projectId)
    await audioStorage.addClip(inline.id, { id: 'embedded', name: 'neu.wav', audio: new Blob(['neu']), start: 0, duration: 10 })
    render(<ProjectTracks projectId={projectId} />)
    const button = await screen.findByRole('button', { name: 'Lösche neu.wav' })
    const failure = vi.spyOn(audioStorage, 'deleteClip').mockRejectedValueOnce(new Error('Speicherfehler'))
    fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gelöscht werden')
    expect(screen.getByRole('button', { name: 'Lösche neu.wav' })).toBeInTheDocument()
    failure.mockRestore()
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lösche neu.wav' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Lösche alt.wav' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lösche alt.wav' })).not.toBeInTheDocument())
    const rows = await audioStorage.readTracks(projectId)
    expect(rows.flatMap(audioStorage.getTrackClips)).toHaveLength(0)
    expect(rows.find((track) => track.id === legacy.id)?.audio).toBeUndefined()
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
