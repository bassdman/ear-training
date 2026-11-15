import { Blob as NodeBlob } from 'node:buffer'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addClip, addEmptyTrack, addTrack, duplicateTrack, getTrackClips, insertRecording, readTracks, type AudioClip } from './audioStorage'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', NodeBlob)
})
afterEach(() => vi.unstubAllGlobals())

const audio = () => new Blob(['original'], { type: 'audio/wav' })
const recording = (start: number, duration: number): AudioClip => ({ id: 'recording', name: 'Aufnahme', audio: new Blob(['recording']), start, duration })

describe('Aufnahme in Spur einfügen', () => {
  it('bewahrt beide Ränder und gemeinsam verwendete Audiodaten', async () => {
    const track = await addEmptyTrack('project')
    await addClip(track.id, { id: 'original', name: 'Original', audio: audio(), start: 2, sourceStart: 3, duration: 10 })
    const duplicateId = await duplicateTrack('project', track.id)
    const expected = (await readTracks('project')).find((item) => item.id === track.id)!
    const shared = getTrackClips(expected)[0].audioId
    await insertRecording(expected, recording(5, 3), {})
    const tracks = await readTracks('project')
    const clips = getTrackClips(tracks.find((item) => item.id === track.id)!)
    expect(clips).toHaveLength(3)
    expect(clips[0]).toMatchObject({ id: 'original', start: 2, duration: 3, sourceStart: 3, audioId: shared })
    expect(clips[1]).toMatchObject({ start: 8, duration: 4, sourceStart: 9, audioId: shared })
    expect(clips[1].id).not.toBe(clips[0].id)
    expect(clips[2]).toMatchObject({ id: 'recording', start: 5, duration: 3 })
    expect(getTrackClips(tracks.find((item) => item.id === duplicateId)!)[0].audioId).toBe(shared)
  })

  it('erhält Legacy-Audio an beiden Rändern', async () => {
    const file = Object.assign(audio(), { name: 'alt.wav' }) as File
    const track = await addTrack('project', file)
    await insertRecording(track, recording(3, 4), { [`${track.id}:legacy`]: 10 })
    const clips = getTrackClips((await readTracks('project'))[0])
    expect(clips).toHaveLength(3)
    expect(clips[0]).toMatchObject({ start: 0, duration: 3 })
    expect(clips[1]).toMatchObject({ start: 7, duration: 3, sourceStart: 7 })
    expect(clips[0].audioId).toBe(clips[1].audioId)
    expect(clips[2]).toMatchObject({ start: 3, duration: 4 })
  })

  it('ersetzt vollständig überdeckte und angeschnittene Blöcke', async () => {
    const track = await addEmptyTrack('project')
    await addClip(track.id, { id: 'left', name: 'links', audio: audio(), start: 0, duration: 4 })
    await addClip(track.id, { id: 'middle', name: 'mitte', audio: audio(), start: 5, duration: 2 })
    await addClip(track.id, { id: 'right', name: 'rechts', audio: audio(), start: 8, duration: 4, sourceStart: 2 })
    const expected = (await readTracks('project'))[0]
    await insertRecording(expected, recording(2, 8), {})
    const clips = getTrackClips((await readTracks('project'))[0])
    expect(clips).toHaveLength(3)
    expect(clips).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'left', start: 0, duration: 2 }),
      expect.objectContaining({ id: 'right', start: 10, duration: 2, sourceStart: 4 }),
      expect.objectContaining({ id: 'recording', start: 2, duration: 8 }),
    ]))
  })

  it('bricht bei unbekannter Dauer oder veränderter Zielspur atomar ab', async () => {
    const track = await addEmptyTrack('project')
    await addClip(track.id, { id: 'clip', name: 'alt', audio: audio(), start: 0 })
    const expected = (await readTracks('project'))[0]
    await expect(insertRecording(expected, recording(1, 2), {})).rejects.toThrow('Dauer')
    expect(getTrackClips((await readTracks('project'))[0])).toHaveLength(1)
    await addClip(track.id, { id: 'new', name: 'neu', audio: audio(), start: 20, duration: 2 }, { clip: 10 })
    await expect(insertRecording(expected, recording(1, 2), { clip: 10 })).rejects.toThrow('geändert')
    expect(getTrackClips((await readTracks('project'))[0]).map((clip) => clip.id)).toEqual(['clip', 'new'])
  })
})
