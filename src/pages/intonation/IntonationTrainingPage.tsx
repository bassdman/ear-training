import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './intonationTrainingPage.css'

const ASSETS_URL = 'http://intonation.manuelgelsen.de/assets'
const possibleNotes = [
  'c2-disabled', 'cis2-disabled', 'd2-disabled', 'dis2-disabled', 'e2-disabled', 'f2-disabled', 'fis2', 'g2', 'gis2', 'a2', 'ais2', 'h2',
  'c3', 'cis3', 'd3', 'dis3', 'e3', 'f3', 'fis3', 'g3', 'gis3', 'a3', 'ais3', 'h3',
  'c4', 'cis4', 'd4', 'dis4', 'e4', 'f4', 'fis4', 'g4', 'gis4', 'a4', 'ais4', 'h4',
  'c5', 'cis5', 'd5-disabled'
]

const noteLabels = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H']
const noteNames = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'h']
const blackKeys = [false, true, false, true, false, false, true, false, true, false, true, false]

function getNoteConfig(noteId: string) {
  const normalizedNoteId = noteId.replace(/-disabled$/, '')
  const match = normalizedNoteId.match(/^(c(?:is)?|d(?:is)?|e|f(?:is)?|g(?:is)?|a(?:is)?|h)(\d+)$/)
  if (!match) return { note: '', octave: 0, disabled: false }

  return {
    note: match[1],
    octave: Number(match[2]),
    disabled: noteId.endsWith('-disabled'),
  }
}

type ActiveNote = string | null

export function IntonationTrainingPage() {
  const navigate = useNavigate()
  const [activeNote, setActiveNote] = useState<ActiveNote>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeTimerRef = useRef<number | null>(null)
  const octaves = [...new Set(possibleNotes.map((noteId) => getNoteConfig(noteId).octave))].sort((a, b) => a - b)

  const playNote = (noteId: string) => {
    const noteConfig = getNoteConfig(noteId)
    if (noteConfig.disabled) return

    const audioPath = `${ASSETS_URL}/sounds/${noteConfig.octave}${noteConfig.note}.mp3`
    currentAudioRef.current?.pause()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)

    const audio = new Audio(audioPath)
    currentAudioRef.current = audio
    audio.preload = 'auto'
    audio.addEventListener('error', () => {
      if (currentAudioRef.current !== audio) return
      setAudioError(`Die Audiodatei ${audioPath} konnte nicht geladen werden.`)
      setActiveNote(null)
    }, { once: true })
    audio.currentTime = 0
    setAudioError(null)
    void audio.play().catch(() => {
      if (currentAudioRef.current !== audio) return
      setAudioError(`Die Audiodatei ${audioPath} kann dieser Browser nicht abspielen.`)
      setActiveNote(null)
    })
    setActiveNote(noteId)
    activeTimerRef.current = window.setTimeout(() => setActiveNote(null), 200)
  }

  useEffect(() => () => {
    currentAudioRef.current?.pause()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)
  }, [])

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
          {octaves.map((octave) => {
            const octaveNotes = possibleNotes.filter((noteId) => getNoteConfig(noteId).octave === octave)

            return (
              <section className="intonation-octave" key={octave}>
                <h2>Oktave {octave}</h2>
                <div className="intonation-notes">
                  {octaveNotes.map((noteId) => {
                    const noteConfig = getNoteConfig(noteId)
                    const noteIndex = noteNames.indexOf(noteConfig.note)
                    const isActive = activeNote === noteId

                    return (
                      <button
                        className={`intonation-note ${blackKeys[noteIndex] ? 'is-black' : ''} ${isActive ? 'is-active' : ''}`}
                        key={noteId}
                        disabled={noteConfig.disabled}
                        onClick={() => playNote(noteId)}
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