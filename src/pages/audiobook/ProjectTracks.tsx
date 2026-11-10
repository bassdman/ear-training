import { useEffect, useRef, useState } from 'react'

import { addClip, addEmptyTrack, getTrackClips, moveClip, readTracks, updateTrackMix, type AudioTrack, type TrackMix } from './audioStorage'
import { createProjectId } from './storage'
import { AudioTimeline } from './AudioTimeline'
import { decodeWaveform } from './waveform'

const AUDIO_EXTENSION = /\.(aac|aif|aiff|amr|caf|flac|m4a|m4b|mp3|mp4|mpga|oga|ogg|opus|wav|wave|webm)$/i

export function ProjectTracks({ projectId }: { projectId: string }) {
  const [tracks, setTracks] = useState<AudioTrack[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mixError, setMixError] = useState('')
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let active = true
    readTracks(projectId).then((saved) => {
      if (active) setTracks(saved)
    }).catch(() => {
      if (active) setError('Die Audiospuren konnten nicht geladen werden. Bitte prüfe den Browserspeicher.')
    })
    return () => { active = false }
  }, [projectId])

  async function importAudio(trackId: string, start: number, durations: Record<string, number>, file: File) {
    if (!file.type.startsWith('audio/') && file.type !== '' && !AUDIO_EXTENSION.test(file.name)) {
      setError('Bitte wähle eine Audiodatei aus.')
      return
    }
    if (file.size === 0) {
      setError('Die ausgewählte Audiodatei ist leer.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const { waveform } = await decodeWaveform(file)
      const track = tracks?.find((item) => item.id === trackId)
      if (!track) throw new Error('Spur nicht gefunden')
      if (!Number.isFinite(waveform.duration) || waveform.duration <= 0) throw new Error('Ungültige Audiodauer')
      const overlapping = getTrackClips(track).some((clip) =>
        start < clip.start + (durations[clip.id] ?? clip.duration ?? 0) && start + waveform.duration > clip.start,
      )
      if (overlapping) {
        setError('Der Audioblock würde einen vorhandenen Block überlappen. Bitte wähle eine andere Position.')
        return
      }
      const clip = { id: createProjectId(), name: file.name, audio: file, start, duration: waveform.duration }
      await addClip(trackId, clip, durations)
      setTracks((current) => current && current.map((item) => item.id === trackId
        ? { ...item, clips: [...getTrackClips(item), clip] }
        : item))
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'Audioblock überlappt'
        ? 'Der Audioblock würde einen vorhandenen Block überlappen. Bitte wähle eine andere Position.'
        : 'Die Audiodatei konnte nicht importiert werden. Bitte prüfe das Format und den verfügbaren Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function createTrack() {
    setBusy(true)
    setError('')
    try {
      const track = await addEmptyTrack(projectId)
      setTracks((current) => current && [...current, track])
    } catch {
      setError('Die Spur konnte nicht gespeichert werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function moveAudio(sourceId: string, targetId: string, clipId: string, start: number, durations: Record<string, number>) {
    setBusy(true)
    setError('')
    try {
      await moveClip(sourceId, targetId, clipId, start, durations)
      setTracks((current) => {
        if (!current) return current
        const clip = current.flatMap(getTrackClips).find((item) => item.id === clipId)
        if (!clip) return current
        const updated = { ...clip, start, duration: clip.duration ?? durations[clip.id] }
        return current.map((track) => {
          if (track.id !== sourceId && track.id !== targetId) return track
          const remaining = getTrackClips(track).filter((item) => item.id !== clipId)
          return { ...track, clips: track.id === targetId ? [...remaining, updated] : remaining }
        })
      })
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('überlappt')
        ? 'Der Audioblock kann dort nicht abgelegt werden: Ein Block überlappt oder seine Dauer ist unbekannt.'
        : 'Der Audioblock konnte nicht verschoben werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  function changeTrackMix(id: string, patch: Partial<TrackMix>) {
    setTracks((current) => current && current.map((track) => track.id === id ? { ...track, ...patch } : track))
    const operation = writeQueue.current.then(() => updateTrackMix(id, patch))
    writeQueue.current = operation.catch(() => {
      setMixError('Die Spureinstellung konnte nicht gespeichert werden. Sie gilt nur bis zum erneuten Öffnen.')
    })
  }

  return (
    <section aria-label="Audiospuren" className="audiobook-tracks">
      {error && <p className="audiobook-error" role="alert">{error}</p>}
      {mixError && <p className="audiobook-error" role="alert">{mixError}</p>}
      {tracks === null ? (
        !error && <p>Lade Audiospuren ...</p>
      ) : (
        <>
          <AudioTimeline tracks={tracks} onMixChange={changeTrackMix} onImport={(...args) => void importAudio(...args)} onMove={(...args) => void moveAudio(...args)} busy={busy} />
          <button type="button" className="audiobook-secondary audiobook-add-button" disabled={busy} onClick={() => void createTrack()}>
            <span aria-hidden="true">+</span> Spur hinzufügen
          </button>
        </>
      )}
    </section>
  )
}
