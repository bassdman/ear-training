import { Blob as NodeBlob } from 'node:buffer'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addClip, addEmptyTrack, applyWordSeparation, deleteTrack, duplicateTrack, getTrackClips, readTracks, saveProjectLyrics, readProjectLyrics } from '../../pages/audiobook/audioStorage'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', NodeBlob)
})
afterEach(() => vi.unstubAllGlobals())

describe('Gespeicherte Worttrennung', () => {
  it('erhält Positionen, Quellausschnitte, Mix, Liedtexte und gemeinsam genutztes Audio', async () => {
    const track = await addEmptyTrack('project', 'vocal')
    await addClip(track.id, { id: 'clip', name: 'voice.wav', audio: new Blob(['voice'], { type: 'audio/wav' }), start: 5, sourceStart: 2, duration: 4 })
    await saveProjectLyrics({ id: 'text', projectId: 'project', trackId: track.id, text: 'Hallo', createdAt: 1 })
    const copyId = await duplicateTrack('project', track.id)
    const before = (await readTracks('project')).find((item) => item.id === track.id)!
    await applyWordSeparation(before, [{ clipId: 'clip', duration: 4, segments: [{ start: 0.3, end: 1 }, { start: 2, end: 3.5 }] }])
    let tracks = await readTracks('project')
    const result = tracks.find((item) => item.id === track.id)!
    const clips = getTrackClips(result)
    expect(clips).toMatchObject([
      { start: 5.3, sourceStart: 2.3, duration: 0.7, name: 'voice.wav' },
      { start: 7, sourceStart: 4, duration: 1.5, name: 'voice.wav' },
    ])
    expect(new Set(clips.map((clip) => clip.id)).size).toBe(2)
    expect(clips[0].audioId).toBe(clips[1].audioId)
    expect(clips[0].audioId).toBe(getTrackClips(tracks.find((item) => item.id === copyId)!)[0].audioId)
    expect(await readProjectLyrics('project')).toMatchObject([{ trackId: track.id, text: 'Hallo' }])
    await deleteTrack(copyId)
    tracks = await readTracks('project')
    expect(await getTrackClips(tracks[0])[0].audio.text()).toBe('voice')
  })

  it('leert vollständig stille Spuren und bewahrt Audio in anderen Spuren', async () => {
    const track = await addEmptyTrack('project', 'vocal')
    await addClip(track.id, { id: 'clip', name: 'silence', audio: new Blob(['sound']), start: 0, duration: 1 })
    const copyId = await duplicateTrack('project', track.id)
    const before = (await readTracks('project')).find((item) => item.id === track.id)!
    await applyWordSeparation(before, [{ clipId: 'clip', duration: 1, segments: [] }])
    const tracks = await readTracks('project')
    expect(getTrackClips(tracks.find((item) => item.id === track.id)!)).toEqual([])
    expect(await getTrackClips(tracks.find((item) => item.id === copyId)!)[0].audio.text()).toBe('sound')
  })

  it('verweigert fremde, veränderte oder ungültige Spuren ohne Teilergebnis', async () => {
    const track = await addEmptyTrack('project', 'vocal')
    await addClip(track.id, { id: 'clip', name: 'voice', audio: new Blob(['a']), start: 0, duration: 1 })
    const [before] = await readTracks('project')
    await expect(applyWordSeparation({ ...before, projectId: 'other' }, [{ clipId: 'clip', duration: 1, segments: [] }])).rejects.toThrow('während der Analyse geändert')
    await expect(applyWordSeparation(before, [{ clipId: 'clip', duration: 1, segments: [{ start: 0.5, end: 1.5 }] }])).rejects.toThrow('Ungültiger Trennungsplan')
    await addClip(track.id, { id: 'other', name: 'other', audio: new Blob(['b']), start: 1, duration: 1 })
    await expect(applyWordSeparation(before, [{ clipId: 'clip', duration: 1, segments: [] }])).rejects.toThrow('während der Analyse geändert')
    expect(getTrackClips((await readTracks('project'))[0])).toHaveLength(2)
    const mixed = await addEmptyTrack('project', 'mixed')
    const mixedBefore = (await readTracks('project')).find((item) => item.id === mixed.id)!
    await expect(applyWordSeparation(mixedBefore, [])).rejects.toThrow()
  })
})
