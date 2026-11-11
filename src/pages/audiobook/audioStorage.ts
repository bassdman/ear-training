import { createProjectId } from './storage'

const DATABASE_NAME = 'ear-training-audiobook'
const STORE_NAME = 'tracks'
const AUDIO_STORE = 'audio'
const PROJECT_INDEX = 'projectId'

export type TrackType = 'vocal' | 'instrumental' | 'mixed'

export type AudioTrack = {
  id: string
  projectId: string
  name: string
  audio?: Blob
  clips?: AudioClip[]
  createdAt: number
  volume?: number
  muted?: boolean
  type?: TrackType
}

export type AudioClip = {
  id: string
  name: string
  audio: Blob
  start: number
  duration?: number
  sourceStart?: number
  audioId?: string
}

type StoredClip = Omit<AudioClip, 'audio'> & { audio?: Blob }
type StoredTrack = Omit<AudioTrack, 'clips'> & { clips?: StoredClip[] }

function storedClips(track: StoredTrack): StoredClip[] {
  if (track.clips) return track.clips
  return track.audio ? [{ id: `${track.id}:legacy`, name: track.name, audio: track.audio, start: 0 }] : []
}

export function getTrackClips(track: AudioTrack): AudioClip[] {
  if (track.clips) return track.clips
  return track.audio ? [{ id: `${track.id}:legacy`, name: track.name, audio: track.audio, start: 0 }] : []
}

export function getTrackType(track: Pick<AudioTrack, 'type'>): TrackType {
  return track.type ?? 'mixed'
}

export type TrackMix = { volume: number, muted: boolean }

export function getTrackMix(track: AudioTrack): TrackMix {
  const volume = track.volume
  return {
    volume: typeof volume === 'number' && Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
    muted: track.muted === true,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2)
    let blocked = false
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex(PROJECT_INDEX, 'projectId')
      }
      request.result.createObjectStore(AUDIO_STORE, { keyPath: 'id' })
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new Error('Die Audiodatenbank ist durch einen anderen Tab blockiert.'))
    }
    request.onsuccess = () => {
      const db = request.result
      if (blocked) {
        db.close()
        return
      }
      db.onversionchange = () => db.close()
      resolve(db)
    }
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

function sortTracks(tracks: AudioTrack[]) {
  return tracks.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export async function readTracks(projectId: string): Promise<AudioTrack[]> {
  const db = await openDatabase()
  try {
    return await new Promise<AudioTrack[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readonly')
      const request = transaction.objectStore(STORE_NAME).index(PROJECT_INDEX).getAll(projectId)
      const blobs = new Map<string, Blob>()
      let tracks: StoredTrack[] = []
      let failure: Error | undefined
      request.onsuccess = () => {
        tracks = request.result
        const ids = new Set(tracks.flatMap((track) => storedClips(track).flatMap((clip) => clip.audioId ? [clip.audioId] : [])))
        for (const id of ids) {
          const audioRequest = transaction.objectStore(AUDIO_STORE).get(id)
          audioRequest.onsuccess = () => {
            const record: { audio: Blob } | undefined = audioRequest.result
            if (!record?.audio) {
              failure = new Error('Audiodatei nicht gefunden')
              transaction.abort()
            } else blobs.set(id, record.audio)
          }
        }
      }
      transaction.oncomplete = () => {
        const hydrated: AudioTrack[] = []
        for (const track of tracks) {
          const clips: AudioClip[] = []
          for (const clip of track.clips ?? []) {
            const audio = clip.audioId ? blobs.get(clip.audioId) : clip.audio
            if (!audio) {
              reject(new Error('Audiodatei nicht gefunden'))
              return
            }
            clips.push({ ...clip, audio })
          }
          hydrated.push({ ...track, type: getTrackType(track), clips: track.clips ? clips : undefined })
        }
        resolve(sortTracks(hydrated))
      }
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function addTrack(projectId: string, file: File): Promise<AudioTrack> {
  const track: AudioTrack = {
    id: createProjectId(),
    projectId,
    name: file.name,
    audio: file,
    createdAt: Date.now(),
    volume: 1,
    muted: false,
  }
  await withStore('readwrite', (store) => store.add(track))
  return track
}

export async function addEmptyTrack(projectId: string, type: TrackType = 'mixed'): Promise<AudioTrack> {
  const track: AudioTrack = {
    id: createProjectId(), projectId, name: '', clips: [], type,
    createdAt: Date.now(), volume: 1, muted: false,
  }
  await withStore('readwrite', (store) => store.add(track))
  return track
}

export async function addClip(trackId: string, clip: AudioClip, durations: Record<string, number> = {}): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(trackId)
      let failure: Error | undefined
      request.onsuccess = () => {
        const track: StoredTrack | undefined = request.result
        if (!track) {
          failure = new Error('Spur nicht gefunden')
          transaction.abort()
          return
        }
        const existing = storedClips(track)
        const unknown = existing.some((item) => item.duration === undefined && durations[item.id] === undefined)
        const overlaps = existing.some((item) =>
          clip.start < item.start + (item.duration ?? durations[item.id] ?? 0)
          && clip.start + (clip.duration ?? 0) > item.start,
        )
        if (unknown || overlaps) {
          failure = new Error(overlaps ? 'Audioblock überlappt' : 'Audiodauer unbekannt')
          transaction.abort()
          return
        }
        const { audio: _legacyAudio, ...rest } = track
        store.put({ ...rest, clips: [...existing, clip] })
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Transaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function pasteClip(projectId: string, targetId: string, source: AudioClip, start: number, durations: Record<string, number>): Promise<void> {
  if (!Number.isFinite(start) || start < 0 || !source.duration || !Number.isFinite(source.duration) || source.duration <= 0) {
    throw new Error('Ungültige Position oder Audiodauer')
  }
  const duration = source.duration
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const audioStore = transaction.objectStore(AUDIO_STORE)
      const request = store.index(PROJECT_INDEX).getAll(projectId)
      let failure: Error | undefined
      request.onsuccess = () => {
        const tracks: StoredTrack[] = request.result
        const target = tracks.find((track) => track.id === targetId)
        if (!target) {
          failure = new Error('Spur nicht gefunden')
          transaction.abort()
          return
        }
        const existing = storedClips(target)
        if (existing.some((item) => {
          const length = item.duration ?? durations[item.id]
          return !length || !Number.isFinite(length) || length <= 0
            || (start < item.start + length && start + duration > item.start)
        })) {
          failure = new Error('Audioblock überlappt oder Audiodauer unbekannt')
          transaction.abort()
          return
        }
        const sourceTrack = tracks.find((track) => storedClips(track).some((clip) => clip.id === source.id))
        const original = sourceTrack && storedClips(sourceTrack).find((clip) => clip.id === source.id)
        const audioId = original?.audioId ?? source.audioId ?? createProjectId()
        const audioRequest = audioStore.get(audioId)
        audioRequest.onsuccess = () => {
          if (!audioRequest.result) audioStore.add({ id: audioId, projectId, audio: source.audio })
          const { audio: _audio, ...reference } = source
          const copy: StoredClip = { ...reference, id: createProjectId(), audioId, start, duration }
          const promote = (track: StoredTrack) => storedClips(track).map((clip) => {
            if (clip.id !== source.id || clip.audioId) return clip
            const { audio: _clipAudio, ...rest } = clip
            return { ...rest, audioId }
          })
          if (sourceTrack && sourceTrack.id !== target.id && original && !original.audioId) {
            const { audio: _legacyAudio, ...rest } = sourceTrack
            store.put({ ...rest, clips: promote(sourceTrack) })
          }
          const { audio: _targetAudio, ...rest } = target
          store.put({ ...rest, clips: [...promote(target), copy] })
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Transaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function moveClip(
  sourceId: string,
  targetId: string,
  clipId: string,
  start: number,
  durations: Record<string, number>,
): Promise<void> {
  if (!Number.isFinite(start) || start < 0) throw new Error('Ungültige Position')
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const sourceRequest = store.get(sourceId)
      const targetRequest = sourceId === targetId ? sourceRequest : store.get(targetId)
      let failure: Error | undefined
      const applyMove = () => {
        if (sourceRequest.readyState !== 'done' || targetRequest.readyState !== 'done') return
        const source: StoredTrack | undefined = sourceRequest.result
        const target: StoredTrack | undefined = targetRequest.result
        const clip = source && storedClips(source).find((item) => item.id === clipId)
        const duration = clip && (clip.duration ?? durations[clip.id])
        if (!source || !target || source.projectId !== target.projectId || !clip || !duration || !Number.isFinite(duration)) {
          failure = new Error('Spur oder Audioblock nicht verfügbar')
          transaction.abort()
          return
        }
        const existing = storedClips(target).filter((item) => item.id !== clipId)
        if (existing.some((item) => {
          const itemDuration = item.duration ?? durations[item.id]
          return !itemDuration || !Number.isFinite(itemDuration)
            || (start < item.start + itemDuration && start + duration > item.start)
        })) {
          failure = new Error('Audioblock überlappt oder Audiodauer unbekannt')
          transaction.abort()
          return
        }
        const updatedClip = { ...clip, start, duration }
        const { audio: _sourceAudio, ...sourceRest } = source
        if (sourceId === targetId) {
          store.put({ ...sourceRest, clips: [...existing, updatedClip] })
        } else {
          const { audio: _targetAudio, ...targetRest } = target
          store.put({ ...sourceRest, clips: storedClips(source).filter((item) => item.id !== clipId) })
          store.put({ ...targetRest, clips: [...existing, updatedClip] })
        }
      }
      sourceRequest.onsuccess = applyMove
      if (targetRequest !== sourceRequest) targetRequest.onsuccess = applyMove
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Transaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function splitClip(trackId: string, clipId: string, at: number, duration: number): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(trackId)
      let failure: Error | undefined
      request.onsuccess = () => {
        const track: StoredTrack | undefined = request.result
        const clips = track ? storedClips(track) : []
        const clip = clips.find((item) => item.id === clipId)
        const length = clip?.duration ?? duration
        if (!track || !clip || !Number.isFinite(at) || !Number.isFinite(length) || length <= 0 || at <= clip.start || at >= clip.start + length) {
          failure = new Error('Ungültige Schnittposition')
          transaction.abort()
          return
        }
        const audioId = clip.audioId ?? createProjectId()
        if (!clip.audioId) {
          if (!clip.audio) {
            failure = new Error('Audiodatei nicht gefunden')
            transaction.abort()
            return
          }
          transaction.objectStore(AUDIO_STORE).add({ id: audioId, projectId: track.projectId, audio: clip.audio })
        }
        const { audio: _audio, ...reference } = clip
        const firstLength = at - clip.start
        const first: StoredClip = { ...reference, audioId, duration: firstLength }
        const second: StoredClip = { ...reference, id: createProjectId(), audioId, start: at, sourceStart: (clip.sourceStart ?? 0) + firstLength, duration: length - firstLength }
        const { audio: _legacyAudio, ...rest } = track
        store.put({ ...rest, clips: clips.flatMap((item) => item.id === clipId ? [first, second] : [item]) })
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

function deleteUnreferencedAudio(store: IDBObjectStore, audioStore: IDBObjectStore, projectId: string, ids: Set<string>) {
  if (!ids.size) return
  const request = store.index(PROJECT_INDEX).getAll(projectId)
  request.onsuccess = () => {
    const tracks: StoredTrack[] = request.result
    for (const track of tracks) {
      for (const clip of storedClips(track)) {
        if (clip.audioId) ids.delete(clip.audioId)
      }
    }
    for (const id of ids) audioStore.delete(id)
  }
}

export async function deleteClip(trackId: string, clipId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(trackId)
      let failure: Error | undefined
      request.onsuccess = () => {
        const track: StoredTrack | undefined = request.result
        const clips = track ? storedClips(track) : []
        const clip = clips.find((item) => item.id === clipId)
        if (!track || !clip) {
          failure = new Error('Spur oder Audioblock nicht gefunden')
          transaction.abort()
          return
        }
        const remaining = clips.filter((item) => item.id !== clipId)
        const { audio: _legacyAudio, ...rest } = track
        store.put({ ...rest, clips: remaining })
        if (clip.audioId) {
          deleteUnreferencedAudio(store, transaction.objectStore(AUDIO_STORE), track.projectId, new Set([clip.audioId]))
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function deleteTrack(trackId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(trackId)
      let failure: Error | undefined
      request.onsuccess = () => {
        const track: StoredTrack | undefined = request.result
        if (!track) {
          failure = new Error('Spur nicht gefunden')
          transaction.abort()
          return
        }
        const ids = new Set(storedClips(track).flatMap((clip) => clip.audioId ? [clip.audioId] : []))
        store.delete(trackId)
        deleteUnreferencedAudio(store, transaction.objectStore(AUDIO_STORE), track.projectId, ids)
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function updateTrackMix(id: string, patch: Partial<TrackMix>): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)
      request.onsuccess = () => {
        const track: AudioTrack | undefined = request.result
        if (!track) {
          transaction.abort()
          return
        }
        store.put({ ...track, ...patch })
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Spur nicht gefunden oder Transaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}

export async function deleteProjectTracks(projectId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, AUDIO_STORE], 'readwrite')
      const request = transaction.objectStore(STORE_NAME).index(PROJECT_INDEX).openKeyCursor(projectId)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          transaction.objectStore(STORE_NAME).delete(cursor.primaryKey)
          cursor.continue()
        }
        const audioCursor = transaction.objectStore(AUDIO_STORE).openCursor()
        audioCursor.onsuccess = () => {
          const cursor = audioCursor.result
          if (cursor) {
            if (cursor.value.projectId === projectId) cursor.delete()
            cursor.continue()
          }
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Datenbanktransaktion abgebrochen'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Datenbankfehler'))
    })
  } finally {
    db.close()
  }
}
