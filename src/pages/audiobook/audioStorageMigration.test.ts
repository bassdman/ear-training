import { IDBFactory } from 'fake-indexeddb'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'

import { readProjectDocuments, readProjectLyrics, readTracks, saveProjectLyrics } from './audioStorage'

afterEach(() => vi.unstubAllGlobals())

it('migriert eine Version-2-Datenbank ohne Verlust vorhandener Audiodaten', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ear-training-audiobook', 2)
    request.onupgradeneeded = () => {
      const tracks = request.result.createObjectStore('tracks', { keyPath: 'id' })
      tracks.createIndex('projectId', 'projectId')
      request.result.createObjectStore('audio', { keyPath: 'id' })
      tracks.put({ id: 'track', projectId: 'song', name: 'Gesang', type: 'vocal', createdAt: 1,
        clips: [{ id: 'clip', name: 'Audio', audioId: 'audio', start: 0 }] })
      request.transaction?.objectStore('audio').put({ id: 'audio', projectId: 'song', audio: new NodeBlob(['audio'], { type: 'audio/wav' }) })
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => { request.result.close(); resolve() }
  })

  const tracks = await readTracks('song')
  expect(tracks).toHaveLength(1)
  expect(tracks[0].clips?.[0]).toMatchObject({ id: 'clip', audioId: 'audio' })
  expect(tracks[0].clips?.[0].audio.size).toBe(5)
  expect(await readProjectLyrics('song')).toEqual([])
  expect(await readProjectDocuments('song')).toEqual([])
  await saveProjectLyrics({ id: 'text', projectId: 'song', trackId: 'track', text: 'Hallo', createdAt: 1 })
  expect(await readProjectLyrics('song')).toMatchObject([{ text: 'Hallo', trackId: 'track' }])
})
