import JSZip from 'jszip'
import { deleteProjectTracks, getTrackClips, getTrackMix, getTrackType, MAX_TRACK_VOLUME, readProjectDocuments, readProjectLyrics, readTracks, restoreProjectData, type AudioTrack, type ProjectDocument, type ProjectLyrics, type TrackType } from './audioStorage'
import { createProjectId, readProjects, writeProjects, type AudiobookProject } from './storage'

type ArchiveClip = { id: string, name: string, start: number, duration?: number, sourceStart?: number, file: string, mime: string }
type ArchiveTrack = { id: string, name: string, createdAt: number, volume: number, muted: boolean, type: TrackType, clips: ArchiveClip[] }
type ArchiveLyrics = { id: string, text: string, trackId: string | null, createdAt: number }
type ArchiveDocument = { id: string, name: string, description: string, createdAt: number, file: string, mime: string }
type Manifest = { version: 1, name: string, tracks: ArchiveTrack[], lyrics: ArchiveLyrics[], documents: ArchiveDocument[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isManifest(value: unknown): value is Manifest {
  if (!isRecord(value) || value.version !== 1 || typeof value.name !== 'string' || !value.name.trim()
    || !Array.isArray(value.tracks) || !Array.isArray(value.lyrics) || !Array.isArray(value.documents)) return false
  const tracks: unknown[] = value.tracks
  const lyrics: unknown[] = value.lyrics
  const documents: unknown[] = value.documents
  return tracks.every((track) => isRecord(track) && typeof track.id === 'string' && !!track.id
    && typeof track.name === 'string' && isNumber(track.createdAt)
    && isNumber(track.volume) && track.volume >= 0 && track.volume <= MAX_TRACK_VOLUME && typeof track.muted === 'boolean'
    && (track.type === 'vocal' || track.type === 'instrumental' || track.type === 'mixed')
    && Array.isArray(track.clips) && track.clips.every((clip: unknown) => isRecord(clip)
      && typeof clip.id === 'string' && !!clip.id && typeof clip.name === 'string'
      && isNumber(clip.start) && clip.start >= 0
      && (clip.duration === undefined || (isNumber(clip.duration) && clip.duration > 0))
      && (clip.sourceStart === undefined || (isNumber(clip.sourceStart) && clip.sourceStart >= 0))
      && typeof clip.file === 'string' && /^audio\/[0-9]+$/.test(clip.file) && typeof clip.mime === 'string'))
    && lyrics.every((entry) => isRecord(entry) && typeof entry.id === 'string' && !!entry.id
      && typeof entry.text === 'string' && (entry.trackId === null || typeof entry.trackId === 'string') && isNumber(entry.createdAt))
    && documents.every((doc) => isRecord(doc) && typeof doc.id === 'string' && !!doc.id && typeof doc.name === 'string'
      && typeof doc.description === 'string' && isNumber(doc.createdAt)
      && typeof doc.file === 'string' && /^documents\/[0-9]+$/.test(doc.file) && typeof doc.mime === 'string')
}

export async function exportProjectArchive(project: AudiobookProject): Promise<Blob> {
  const [tracks, lyrics, documents] = await Promise.all([readTracks(project.id), readProjectLyrics(project.id), readProjectDocuments(project.id)])
  const zip = new JSZip()
  const audioFiles = new Map<string, string>()
  let audioIndex = 0
  const archiveTracks: ArchiveTrack[] = []
  for (const track of tracks) {
    const clips: ArchiveClip[] = []
    for (const clip of getTrackClips(track)) {
      let file = clip.audioId ? audioFiles.get(clip.audioId) : undefined
      if (!file) {
        file = `audio/${audioIndex++}`
        zip.file(file, await clip.audio.arrayBuffer())
        if (clip.audioId) audioFiles.set(clip.audioId, file)
      }
      clips.push({ id: clip.id, name: clip.name, start: clip.start, duration: clip.duration, sourceStart: clip.sourceStart, file, mime: clip.audio.type })
    }
    archiveTracks.push({ id: track.id, name: track.name, createdAt: track.createdAt, ...getTrackMix(track), type: getTrackType(track), clips })
  }
  const archiveDocuments: ArchiveDocument[] = []
  for (const [index, document] of documents.entries()) {
    const file = `documents/${index}`
    zip.file(file, await document.pdf.arrayBuffer())
    archiveDocuments.push({ id: document.id, name: document.name, description: document.description, createdAt: document.createdAt, file, mime: document.pdf.type })
  }
  const manifest: Manifest = { version: 1, name: project.name, tracks: archiveTracks, lyrics: lyrics.map(({ id, text, trackId, createdAt }) => ({ id, text, trackId, createdAt })), documents: archiveDocuments }
  zip.file('project.json', JSON.stringify(manifest))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export async function importProjectArchive(file: Blob): Promise<AudiobookProject[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const manifestFile = zip.file('project.json')
  if (!manifestFile) throw new Error('Projektdatei enthält keine Projektbeschreibung.')
  const manifest: unknown = JSON.parse(await manifestFile.async('string'))
  if (!isManifest(manifest)) throw new Error('Ungültiges oder nicht unterstütztes Projektformat.')
  const trackIds = new Map(manifest.tracks.map((track) => [track.id, createProjectId()]))
  const vocalTrackIds = new Set(manifest.tracks.filter((track) => track.type === 'vocal').map((track) => track.id))
  if (trackIds.size !== manifest.tracks.length || manifest.lyrics.some((entry) => entry.trackId !== null && !vocalTrackIds.has(entry.trackId))) {
    throw new Error('Ungültige Spurzuordnung in der Projektdatei.')
  }
  const project = { id: createProjectId(), name: manifest.name }
  const audio = new Map<string, { id: string, blob: Blob, mime: string }>()
  async function loadFile(path: string, mime: string): Promise<Blob> {
    const entry = zip.file(path)
    if (!entry || entry.dir) throw new Error(`Datei ${path} fehlt im Projekt.`)
    return new Blob([await entry.async('arraybuffer')], { type: mime })
  }
  const tracks: AudioTrack[] = []
  for (const track of manifest.tracks) {
    const clips = []
    for (const clip of track.clips) {
      let entry = audio.get(clip.file)
      if (!entry) {
        entry = { id: createProjectId(), blob: await loadFile(clip.file, clip.mime), mime: clip.mime }
        audio.set(clip.file, entry)
      } else if (entry.mime !== clip.mime) throw new Error('Widersprüchliche Audiodaten im Projekt.')
      clips.push({ id: createProjectId(), name: clip.name, start: clip.start, duration: clip.duration, sourceStart: clip.sourceStart, audioId: entry.id, audio: entry.blob })
    }
    tracks.push({ id: trackIds.get(track.id)!, projectId: project.id, name: track.name, createdAt: track.createdAt, volume: track.volume, muted: track.muted, type: track.type, clips })
  }
  const lyrics: ProjectLyrics[] = manifest.lyrics.map((entry) => ({ ...entry, id: createProjectId(), projectId: project.id, trackId: entry.trackId === null ? null : trackIds.get(entry.trackId)! }))
  const documents: ProjectDocument[] = []
  for (const doc of manifest.documents) {
    documents.push({ id: createProjectId(), projectId: project.id, name: doc.name, description: doc.description, createdAt: doc.createdAt, pdf: await loadFile(doc.file, doc.mime) })
  }
  const projects = await readProjects()
  await restoreProjectData(tracks, lyrics, documents)
  try {
    const updated = [...projects, project]
    await writeProjects(updated)
    return updated
  } catch (error) {
    try {
      await deleteProjectTracks(project.id)
    } catch (cleanupError) {
      console.error('Importierte Projektdaten konnten nicht entfernt werden:', cleanupError)
      throw new Error('Projektliste konnte nicht gespeichert werden; importierte Daten konnten nicht entfernt werden.')
    }
    throw error
  }
}
