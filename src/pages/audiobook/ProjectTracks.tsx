import { useEffect, useState, type ChangeEvent } from 'react'

import { addTrack, readTracks, type AudioTrack } from './audioStorage'
import { AudioTimeline } from './AudioTimeline'

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
          <AudioTimeline tracks={tracks} />
          <div className="audiobook-add-track">
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
