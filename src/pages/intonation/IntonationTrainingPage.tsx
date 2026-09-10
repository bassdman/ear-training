import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './intonationTrainingPage.css'

const ASSETS_URL = 'http://intonation.manuelgelsen.de/assets'
const noteNames = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']
const noteLabels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const blackKeys = [false, true, false, true, false, false, true, false, true, false, true, false]

type ActiveNote = `${number}-${number}` | null

export function IntonationTrainingPage() {
  const navigate = useNavigate()
  const [activeNote, setActiveNote] = useState<ActiveNote>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  const playNote = (octave: number, noteIndex: number) => {
    const audioPath = `${ASSETS_URL}/sounds/${noteNames[noteIndex]}${octave}.mp3`
    const audio = new Audio(audioPath)
    audio.preload = 'auto'
    audio.addEventListener('error', () => {
      setAudioError(`Die Audiodatei ${audioPath} konnte nicht geladen werden.`)
      setActiveNote(null)
    }, { once: true })
    audio.currentTime = 0
    setAudioError(null)
    void audio.play().catch(() => {
      setAudioError(`Die Audiodatei ${audioPath} kann dieser Browser nicht abspielen.`)
      setActiveNote(null)
    })
    setActiveNote(`${octave}-${noteIndex}`)
    window.setTimeout(() => setActiveNote(null), 200)
  }

  return (
    <main className="intonation-page">
      <div className="intonation-shell">
        <header className="intonation-header">
          <button className="intonation-back" onClick={() => navigate('/')}>
            Zur Startseite
          </button>
          <p className="intonation-kicker">Freies Training</p>
          <h1>Intonationstraining</h1>
          <p className="intonation-subtitle">
            Spiele einzelne Töne in verschiedenen Lagen und überprüfe deine Intonation.
          </p>
          {audioError && <p className="intonation-audio-error" role="alert">{audioError}</p>}
        </header>

        <section className="intonation-octaves" aria-label="Noten nach Oktave">
          {Array.from({ length: 4 }, (_, octaveIndex) => octaveIndex + 2).map((octave) => {
            const lastIndex = octave === 5 ? 0 : noteNames.length - 1

            return (
              <section className="intonation-octave" key={octave}>
                <h2>Oktave {octave}</h2>
                <div className="intonation-notes">
                  {noteNames.slice(0, lastIndex + 1).map((_, noteIndex) => {
                    const noteId = `${octave}-${noteIndex}` as ActiveNote
                    const isActive = activeNote === noteId

                    return (
                      <button
                        className={`intonation-note ${blackKeys[noteIndex] ? 'is-black' : ''} ${isActive ? 'is-active' : ''}`}
                        key={noteId}
                        onClick={() => playNote(octave, noteIndex)}
                      >
                        {noteLabels[noteIndex]}{octave}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </section>
      </div>
    </main>
  )
}