import { useEffect, useRef, useState } from 'react'
import { applyWordSeparation, getTrackClips, getTrackType, readTracks, type AudioTrack, type ClipSegments } from '../../pages/audiobook/audioStorage'
import { findSoundSegments } from './separation'

export function useWordSeparation(projectId: string, onApplied: (track: AudioTrack) => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => { controller.current?.abort() }, [projectId])

  async function separate(trackId: string) {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError('')
    setStatus('Pausen werden analysiert ...')
    let applied = false
    try {
      const track = (await readTracks(projectId)).find((item) => item.id === trackId)
      if (!track || getTrackType(track) !== 'vocal') throw new Error('Vocalspur nicht gefunden.')
      const clips = getTrackClips(track)
      if (!clips.length) throw new Error('Die Vocalspur enthält keine Audioblöcke.')
      const context = new AudioContext()
      const segments: ClipSegments[] = []
      try {
        let previousAudio: Blob | undefined
        let previousBuffer: AudioBuffer | undefined
        for (const clip of clips) {
          if (abort.signal.aborted) return
          const buffer = clip.audio === previousAudio && previousBuffer
            ? previousBuffer : await context.decodeAudioData(await clip.audio.arrayBuffer())
          previousAudio = clip.audio
          previousBuffer = buffer
          const sourceStart = clip.sourceStart ?? 0
          const duration = clip.duration ?? buffer.duration - sourceStart
          segments.push({ clipId: clip.id, duration, segments: await findSoundSegments(buffer, sourceStart, duration, abort.signal) })
        }
      } finally {
        await context.close()
      }
      if (abort.signal.aborted) return
      if (segments.every((item) => item.segments.length === 1 && item.segments[0].start === 0
        && Math.abs(item.segments[0].end - item.duration) < 0.0001)) {
        setStatus('Keine ausreichend langen Pausen gefunden. Die Spur wurde nicht verändert.')
        return
      }
      await applyWordSeparation(track, segments)
      applied = true
      const updated = (await readTracks(projectId)).find((item) => item.id === trackId)
      if (!updated) throw new Error('Die bearbeitete Spur konnte nicht geladen werden.')
      if (abort.signal.aborted) return
      onApplied(updated)
      const count = getTrackClips(updated).length
      setStatus(count ? `Pausen entfernt. ${count} Audioblöcke vorhanden.` : 'Die Spur enthielt nur Stille und ist jetzt leer.')
    } catch (cause) {
      if (!abort.signal.aborted) {
        setStatus('')
        setError(applied
          ? 'Die Spur wurde geändert, konnte aber nicht neu geladen werden. Bitte öffne das Projekt erneut.'
          : `Wörter konnten nicht separiert werden: ${cause instanceof Error ? cause.message : 'Unbekannter Fehler.'}`)
      }
    } finally {
      if (controller.current === abort) controller.current = null
      if (!abort.signal.aborted) setBusy(false)
    }
  }
  return { separate, busy, error, status }
}
