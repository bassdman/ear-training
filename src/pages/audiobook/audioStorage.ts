import { createProjectId } from './storage'

const DATABASE_NAME = 'ear-training-audiobook'
const STORE_NAME = 'tracks'
const PROJECT_INDEX = 'projectId'

export type AudioTrack = {
  id: string
  projectId: string
  name: string
  audio: Blob
  createdAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex(PROJECT_INDEX, 'projectId')
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
  return sortTracks(await withStore('readonly', (store) => store.index(PROJECT_INDEX).getAll(projectId)))
}

export async function addTrack(projectId: string, file: File): Promise<AudioTrack> {
  const track: AudioTrack = {
    id: createProjectId(),
    projectId,
    name: file.name,
    audio: file,
    createdAt: Date.now(),
  }
  await withStore('readwrite', (store) => store.add(track))
  return track
}

export async function deleteProjectTracks(projectId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const request = transaction.objectStore(STORE_NAME).index(PROJECT_INDEX).openKeyCursor(projectId)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          transaction.objectStore(STORE_NAME).delete(cursor.primaryKey)
          cursor.continue()
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
