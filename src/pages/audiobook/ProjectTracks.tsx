import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { addTrack, readTracks, updateTrackMix, type AudioTrack, type TrackMix } from './audioStorage'
import { AudioTimeline } from './AudioTimeline'

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
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
      const track = await addTrack(projectId, file)
      setTracks((current) => current && [...current, track].sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ))
    } catch {
      setError('Die Audiodatei konnte nicht gespeichert werden. Bitte prüfe den verfügbaren Browserspeicher.')
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
          <AudioTimeline tracks={tracks} onMixChange={changeTrackMix} />
          <div className="audiobook-add-track">
            <span className="audiobook-track-label">Spur {tracks.length + 1}</span>
            <label className={`audiobook-track-empty ${busy ? 'is-busy' : ''}`}>
              {busy ? 'Audio wird gespeichert ...' : 'Neues Audio hinzufügen'}
              <input type="file" disabled={busy} onChange={(event) => void handleFileChange(event)} />
            </label>
          </div>
        </>
      )}
    </section>
  )
}
