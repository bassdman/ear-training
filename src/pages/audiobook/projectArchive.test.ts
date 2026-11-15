import { Blob as NodeBlob } from 'node:buffer'
import { IDBFactory } from 'fake-indexeddb'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addClip, addEmptyTrack, deleteProjectTracks, readProjectDocuments, readProjectLyrics, readTracks, saveProjectDocument, saveProjectLyrics, splitClip, updateTrackMix } from './audioStorage'
import * as audioStorage from './audioStorage'
import { exportProjectArchive, importProjectArchive } from './projectArchive'
import { AUDIOBOOK_STORAGE_KEY, readProjects, writeProjects } from './storage'

describe('Projektarchiv', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    vi.stubGlobal('Blob', NodeBlob)
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
  })

  it('sichert und importiert Audioschnitte, Mix, Texte und PDFs als unabhängige Kopie', async () => {
    const project = { id: 'original', name: 'Mein Lied' }
    await writeProjects([project])
    const track = await addEmptyTrack(project.id, 'vocal')
    await addClip(track.id, { id: 'clip', name: 'aufnahme.wav', audio: new Blob(['audio'], { type: 'audio/wav' }), start: 3, duration: 10 })
    await splitClip(track.id, 'clip', 7, 10)
    await updateTrackMix(track.id, { volume: 0.4, muted: true })
    await saveProjectLyrics({ id: 'lyric', projectId: project.id, trackId: track.id, text: 'Hallo', createdAt: 4 })
    await saveProjectDocument({ id: 'pdf', projectId: project.id, name: 'Noten', description: 'Beschreibung', pdf: new Blob(['pdf'], { type: 'application/pdf' }), createdAt: 5 })
    const archive = await exportProjectArchive(project)
    const zip = await JSZip.loadAsync(await archive.arrayBuffer())
    expect(Object.keys(zip.files).filter((path) => /^audio\/\d+$/.test(path))).toHaveLength(1)

    const projects = await importProjectArchive(archive)
    expect(projects).toHaveLength(2)
    const imported = projects[1]
    expect(imported).toMatchObject({ name: project.name })
    expect(imported.id).not.toBe(project.id)
    const [copy] = await readTracks(imported.id)
    expect(copy).toMatchObject({ type: 'vocal', volume: 0.4, muted: true, clips: [{ start: 3, duration: 4, sourceStart: undefined }, { start: 7, duration: 6, sourceStart: 4 }] })
    expect(copy.id).not.toBe(track.id)
    expect(copy.clips?.[0].audioId).toBe(copy.clips?.[1].audioId)
    expect(await copy.clips?.[0].audio.text()).toBe('audio')
    expect(await readProjectLyrics(imported.id)).toMatchObject([{ text: 'Hallo', trackId: copy.id }])
    const [document] = await readProjectDocuments(imported.id)
    expect(document).toMatchObject({ name: 'Noten', description: 'Beschreibung' })
    expect(await document.pdf.text()).toBe('pdf')
    await deleteProjectTracks(project.id)
    expect(await (await readTracks(imported.id))[0].clips?.[0].audio.text()).toBe('audio')
  })

  it('weist fehlerhafte Archive und fehlende Dateien ohne Änderung der Projektliste zurück', async () => {
    await writeProjects([{ id: 'existing', name: 'Vorhanden' }])
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify({ version: 1, name: 'Fehler', tracks: [{ id: 't', name: '', createdAt: 1, volume: 1, muted: false, type: 'mixed', clips: [{ id: 'c', name: 'x', start: 0, file: 'audio/0', mime: '' }] }], lyrics: [], documents: [] }))
    await expect(importProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('fehlt')
    await expect(importProjectArchive(new Blob(['kein zip']))).rejects.toThrow()
    expect(await readProjects()).toEqual([{ id: 'existing', name: 'Vorhanden' }])
  })

  it('entfernt importierte Daten, wenn das Speichern der Projektliste fehlschlägt', async () => {
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify({ version: 1, name: 'Fehler', tracks: [{ id: 't', name: '', createdAt: 1, volume: 1, muted: false, type: 'mixed', clips: [{ id: 'c', name: 'x', start: 0, file: 'audio/0', mime: '' }] }], lyrics: [], documents: [] }))
    zip.file('audio/0', 'audio')
    const archive = await zip.generateAsync({ type: 'blob' })
    const cleanup = vi.spyOn(audioStorage, 'deleteProjectTracks')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Speicher voll') })
    await expect(importProjectArchive(archive)).rejects.toThrow('Speicher voll')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(await readTracks(cleanup.mock.calls[0][0])).toEqual([])
    expect(await readProjects()).toEqual([])
  })
})
