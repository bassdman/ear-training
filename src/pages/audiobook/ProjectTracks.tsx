import { useEffect, useState, type ChangeEvent } from 'react'

import { addTrack, readTracks, type AudioTrack } from './audioStorage'

function TrackPlayer({ track, index }: { track: AudioTrack, index: number }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl: string
    try {
      objectUrl = URL.createObjectURL(track.audio)
      setUrl(objectUrl)
    } catch {
      setError('Die Audiodatei konnte nicht zum Abspielen vorbereitet werden.')
      return
    }
    return () => URL.revokeObjectURL(objectUrl)
  }, [track.audio])

  return (
    <article className="audiobook-track">
      <span className="audiobook-track-label">Spur {index + 1}</span>
      <div className="audiobook-track-content">
        <strong>{track.name}</strong>
        {url && (
          <audio
            controls
            preload="metadata"
            src={url}
            aria-label={`${track.name} abspielen`}
            onError={() => setError('Diese Audiodatei kann in diesem Browser nicht abgespielt werden.')}
          />
        )}
        {error && <p className="audiobook-error" role="alert">{error}</p>}
      </div>
    </article>
  )
}

export function ProjectTracks({ projectId }: { projectId: string }) {
  const [tracks, setTracks] = useState<AudioTrack[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    if (!file.type.startsWith('audio/') && file.type !== '') {
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

  return (
    <section aria-label="Audiospuren" className="audiobook-tracks">
      {error && <p className="audiobook-error" role="alert">{error}</p>}
      {tracks === null ? (
        !error && <p>Lade Audiospuren ...</p>
      ) : (
        <>
          {tracks.map((track, index) => <TrackPlayer key={track.id} track={track} index={index} />)}
          <div className="audiobook-track">
            <span className="audiobook-track-label">Spur {tracks.length + 1}</span>
            <label className={`audiobook-track-empty ${busy ? 'is-busy' : ''}`}>
              {busy ? 'Audio wird gespeichert ...' : 'Neues Audio hinzufügen'}
              <input type="file" accept="audio/*" disabled={busy} onChange={(event) => void handleFileChange(event)} />
            </label>
          </div>
        </>
      )}
    </section>
  )
}
