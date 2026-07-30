import { useCallback, useEffect, useRef, useState } from 'react'

const NOTE_FREQS = {
  C: 261.63,
  Cis: 277.18,
  D: 293.66,
  Dis: 311.13,
  E: 329.63,
  F: 349.23,
  Fis: 369.99,
  G: 392.0,
  Gis: 415.3,
  A: 440.0,
  Ais: 466.16,
  H: 493.88,
} as const

const EXERCISES = [
  ['D', 'F', 'A'],
  ['C', 'D', 'F', 'A'],
  ['C', 'D', 'F', 'G', 'A'],
  ['C', 'D', 'E', 'F', 'G', 'A'],
  ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
] as const

const LEVEL_COUNT = EXERCISES.length

const TONE_STYLES = {
  piano: {
    label: 'Klavier',
    oscillatorType: 'triangle' as OscillatorType,
    envelope: { attack: 0.005, decay: 0.22, sustain: 0.15, release: 1.1 },
  },
  guitar: {
    label: 'Gitarre',
    oscillatorType: 'sawtooth' as OscillatorType,
    envelope: { attack: 0.003, decay: 0.18, sustain: 0.04, release: 0.75 },
  },
  flute: {
    label: 'Flöte',
    oscillatorType: 'sine' as OscillatorType,
    envelope: { attack: 0.06, decay: 0.08, sustain: 0.82, release: 0.5 },
  },
  organ: {
    label: 'Orgel',
    oscillatorType: 'square' as OscillatorType,
    envelope: { attack: 0.01, decay: 0.04, sustain: 0.92, release: 0.65 },
  },
} as const

const TONE_STYLE_IDS = Object.keys(TONE_STYLES) as Array<keyof typeof TONE_STYLES>
const SECTION_COUNT = 4
const STREAK_TARGET = 5
const SESSION_MAX_GUESSES = 100

type NoteName = Extract<keyof typeof NOTE_FREQS, string>
type ToneStyleId = Extract<keyof typeof TONE_STYLES, string>

type Trial = {
  note: NoteName
  toneStyle: ToneStyleId
}

type ProgressState = {
  levelIdx?: number
  sectionIdx?: number
  bestStreak?: number
}

async function readProgress(key: string) {
  const customStorage = (window as Window & {
    storage?: { get: (storageKey: string) => Promise<{ value?: string | null } | null> }
  }).storage

  if (customStorage) {
    const result = await customStorage.get(key)
    return result?.value ?? null
  }

  return window.localStorage.getItem(key)
}

async function writeProgress(key: string, value: string) {
  const customStorage = (window as Window & {
    storage?: { set: (storageKey: string, storageValue: string) => Promise<void> }
  }).storage

  if (customStorage) {
    await customStorage.set(key, value)
    return
  }

  window.localStorage.setItem(key, value)
}

export default function EarTrainer() {
  const [loaded, setLoaded] = useState(false)
  const [levelIdx, setLevelIdx] = useState(0)
  const [sectionIdx, setSectionIdx] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [streak, setStreak] = useState(0)

  const [currentNote, setCurrentNote] = useState<NoteName | null>(null)
  const [currentToneStyle, setCurrentToneStyle] = useState<ToneStyleId | null>(null)
  const [forcedTrial, setForcedTrial] = useState<Trial | null>(null)
  const [awaitingGuess, setAwaitingGuess] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [feedback, setFeedback] = useState<{
    correct: boolean
    guessed: NoteName
    actual: NoteName
    toneStyle: ToneStyleId
  } | null>(null)
  const [leveledUpToast, setLeveledUpToast] = useState<string | null>(null)

  const [sessionGuesses, setSessionGuesses] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionEnded, setSessionEnded] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current)
      }
      void audioContextRef.current?.close()
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const rawProgress = await readProgress('earTrainer-progress-v2')
        if (rawProgress) {
          const data = JSON.parse(rawProgress) as ProgressState
          if (typeof data.levelIdx === 'number') setLevelIdx(data.levelIdx)
          if (typeof data.sectionIdx === 'number') setSectionIdx(data.sectionIdx)
          if (typeof data.bestStreak === 'number') setBestStreak(data.bestStreak)
        }
      } catch {
        // noch kein gespeicherter Fortschritt
      }
      setLoaded(true)
    })()
  }, [])

  const saveProgress = useCallback(async (lvl: number, sec: number, best: number) => {
    try {
      await writeProgress('earTrainer-progress-v2', JSON.stringify({ levelIdx: lvl, sectionIdx: sec, bestStreak: best }))
    } catch (error) {
      console.error('Speichern fehlgeschlagen', error)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    void saveProgress(levelIdx, sectionIdx, bestStreak)
  }, [bestStreak, levelIdx, loaded, saveProgress, sectionIdx])

  const toneSet = EXERCISES[levelIdx]
  const unlockedToneStyles = TONE_STYLE_IDS.slice(0, sectionIdx + 1)

  const playTone = async (note: NoteName, toneStyle: ToneStyleId) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext()
    }

    const audioContext = audioContextRef.current
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const style = TONE_STYLES[toneStyle]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime
    const sustainUntil = now + 0.45
    const stopAt = sustainUntil + style.envelope.release

    oscillator.type = style.oscillatorType
    oscillator.frequency.setValueAtTime(NOTE_FREQS[note], now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(0.9, now + style.envelope.attack)
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(style.envelope.sustain, 0.04),
      now + style.envelope.attack + style.envelope.decay,
    )
    gainNode.gain.setValueAtTime(Math.max(style.envelope.sustain, 0.04), sustainUntil)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    setIsPlaying(true)
    oscillator.start(now)
    oscillator.stop(stopAt)

    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current)
    }
    playbackTimeoutRef.current = window.setTimeout(() => setIsPlaying(false), 1000)
  }

  const startTrial = async () => {
    if (sessionEnded) return
    const note = forcedTrial?.note ?? toneSet[Math.floor(Math.random() * toneSet.length)]
    const toneStyle = forcedTrial?.toneStyle ?? unlockedToneStyles[Math.floor(Math.random() * unlockedToneStyles.length)]
    setCurrentNote(note)
    setCurrentToneStyle(toneStyle)
    setFeedback(null)
    setAwaitingGuess(true)
    await playTone(note, toneStyle)
  }

  const replayTone = async () => {
    if (!currentNote || !currentToneStyle) return
    await playTone(currentNote, currentToneStyle)
  }

  const handleGuess = (guessedNote: NoteName) => {
    if (!awaitingGuess || !currentNote || !currentToneStyle) return
    setAwaitingGuess(false)

    const isCorrect = guessedNote === currentNote
    const newGuesses = sessionGuesses + 1
    const newCorrect = sessionCorrect + (isCorrect ? 1 : 0)
    setSessionGuesses(newGuesses)
    setSessionCorrect(newCorrect)
    setFeedback({ correct: isCorrect, guessed: guessedNote, actual: currentNote, toneStyle: currentToneStyle })

    if (!isCorrect) {
      setForcedTrial({ note: currentNote, toneStyle: currentToneStyle })
      setStreak(0)
    } else {
      setForcedTrial(null)
      const newStreak = streak + 1

      if (newStreak >= STREAK_TARGET) {
        let newLevel = levelIdx
        let newSection = sectionIdx
        if (sectionIdx < SECTION_COUNT - 1) {
          newSection = sectionIdx + 1
          setSectionIdx(newSection)
          setLeveledUpToast(`Abschnitt ${newSection + 1}/${SECTION_COUNT} freigeschaltet`)
        } else if (levelIdx < LEVEL_COUNT - 1) {
          newLevel = levelIdx + 1
          newSection = 0
          setLevelIdx(newLevel)
          setSectionIdx(0)
          setLeveledUpToast(`Übung ${newLevel + 1}/${LEVEL_COUNT} freigeschaltet`)
        } else {
          setLeveledUpToast('Höchste Übung gehalten')
        }
        setStreak(0)
        setTimeout(() => setLeveledUpToast(null), 2600)
      } else {
        setStreak(newStreak)
      }

      const newBest = Math.max(bestStreak, newStreak)
      if (newBest !== bestStreak) setBestStreak(newBest)
    }

    if (newGuesses >= SESSION_MAX_GUESSES) {
      setTimeout(() => setSessionEnded(true), 900)
    }
  }

  const newSession = () => {
    setSessionGuesses(0)
    setSessionCorrect(0)
    setSessionEnded(false)
    setFeedback(null)
    setAwaitingGuess(false)
    setCurrentNote(null)
    setCurrentToneStyle(null)
    setForcedTrial(null)
  }

  const accuracy = sessionGuesses > 0 ? Math.round((sessionCorrect / sessionGuesses) * 100) : null
  const streakProgress = Math.min(100, (streak / STREAK_TARGET) * 100)

  const palette = {
    bg: '#12141c',
    bgPanel: '#191c27',
    text: '#f1ecdf',
    textDim: '#9aa0b4',
    gold: '#c9a227',
    goldSoft: '#e6c65c',
    red: '#c1543f',
  }

  return (
    <div
      style={{
        background: palette.bg,
        color: palette.text,
        minHeight: '100vh',
        fontFamily: "'IBM Plex Sans', sans-serif",
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="ear-page"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .ear-page {
          padding: 32px 16px 48px;
        }
        .ear-shell {
          width: min(100%, 760px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .ear-title {
          padding-top: 8px;
          text-align: center;
        }
        .ear-panel {
          position: relative;
          background: ${palette.bgPanel};
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
        }
        .ear-meta {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ear-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ear-retry,
        .ear-feedback,
        .ear-session-copy {
          text-align: center;
        }
        .ear-player {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 8px 0;
        }
        .ear-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          width: 100%;
        }
        .ear-button {
          appearance: none;
          border: none;
          border-radius: 999px;
          padding: 12px 20px;
          font-size: 0.95rem;
          font-weight: 600;
          min-height: 46px;
        }
        .ear-note-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
          gap: 10px;
        }
        .ear-note-button {
          min-height: 52px;
        }
        .ear-session-panel {
          background: ${palette.bgPanel};
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
        }
        @keyframes pulseRing {
          0% { transform: scale(0.85); opacity: 0.9; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .toast { animation: fadeSlide 0.25s ease-out; }
        @media (max-width: 640px) {
          .ear-page {
            padding: 20px 12px 32px;
          }
          .ear-shell {
            gap: 18px;
          }
          .ear-panel,
          .ear-session-panel {
            padding: 16px;
          }
          .ear-actions {
            flex-direction: column;
          }
          .ear-button {
            width: 100%;
          }
          .ear-note-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>

      {!loaded ? (
        <div style={{ color: palette.textDim, marginTop: '96px', textAlign: 'center', fontSize: '0.95rem' }}>Lade Fortschritt …</div>
      ) : (
        <div className="ear-shell">
          <div className="ear-title">
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, letterSpacing: '0.01em', fontSize: 'clamp(1.9rem, 5vw, 2.5rem)' }}>
              Gehörtraining
            </div>
            <div style={{ color: palette.textDim, fontSize: '0.95rem', marginTop: '6px' }}>
              Chromatische Oktave · Ton &amp; Klangfarbe
            </div>
          </div>

          <div className="ear-panel">
            {leveledUpToast && (
              <div
                className="toast"
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  background: palette.gold,
                  color: '#1c1a10',
                  whiteSpace: 'nowrap',
                  maxWidth: 'calc(100% - 24px)',
                }}
              >
                {leveledUpToast}
              </div>
            )}
            <div className="ear-meta">
              <span style={{ color: palette.goldSoft, fontSize: '0.95rem', fontWeight: 600 }}>
                Übung {levelIdx + 1} / {LEVEL_COUNT}
              </span>
              <span style={{ color: palette.textDim, fontSize: '0.8rem' }}>
                Abschnitt {sectionIdx + 1} / {SECTION_COUNT}
              </span>
            </div>
            <div style={{ color: palette.textDim, fontSize: '0.82rem', marginTop: '6px', lineHeight: 1.5 }}>
              Töne: {toneSet.join(' · ')}
            </div>
            <div style={{ color: palette.textDim, fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.5 }}>
              Tonstile im Spiel: {unlockedToneStyles.map((style) => TONE_STYLES[style].label).join(' · ')}
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ color: palette.textDim, fontSize: '0.8rem', marginBottom: '6px' }}>
                Serie: {streak} / {STREAK_TARGET}
              </div>
              <div style={{ background: '#262a38', borderRadius: '999px', height: '6px' }}>
                <div
                  style={{
                    width: `${streakProgress}%`,
                    background: palette.gold,
                    height: '100%',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {!sessionEnded ? (
            <>
              <div className="ear-stats" style={{ color: palette.textDim, fontSize: '0.82rem' }}>
                <span>
                  {sessionGuesses} / {SESSION_MAX_GUESSES} Versuche
                </span>
                {accuracy !== null && <span>{accuracy}% Treffer</span>}
              </div>

              {forcedTrial && (
                <div className="ear-retry" style={{ color: palette.red, fontSize: '0.82rem' }}>
                  Wiederholung: gleicher Tonstil und gleicher Ton wie eben
                </div>
              )}

              <div className="ear-player">
                <div style={{ width: 96, height: 96, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPlaying && (
                    <div
                      style={{ position: 'absolute', inset: 0, borderRadius: '999px', border: `2px solid ${palette.gold}`, animation: 'pulseRing 1s ease-out' }}
                    />
                  )}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '999px',
                      background: isPlaying ? palette.gold : palette.bgPanel,
                      border: `2px solid ${palette.gold}`, 
                      transition: 'background 0.15s ease',
                    }}
                  />
                </div>

                <div className="ear-actions">
                  <button
                    onClick={startTrial}
                    disabled={awaitingGuess}
                    style={{
                      background: awaitingGuess ? '#2a2e3d' : palette.gold,
                      color: awaitingGuess ? palette.textDim : '#1c1a10',
                      borderRadius: '999px',
                      padding: '10px 22px',
                      fontWeight: 600,
                      border: 'none',
                    }}
                    className="ear-button"
                  >
                    {feedback || currentNote ? 'Weiter' : 'Ton abspielen'}
                  </button>
                  <button
                    onClick={replayTone}
                    disabled={!currentNote}
                    style={{
                      background: 'transparent',
                      color: currentNote ? palette.textDim : '#454a5c',
                      border: `1px solid ${currentNote ? palette.textDim : '#454a5c'}`,
                      borderRadius: '999px',
                      padding: '10px 16px',
                    }}
                    className="ear-button"
                  >
                    Nochmal hören
                  </button>
                </div>
              </div>

              <div className="ear-note-grid">
                {toneSet.map((note) => {
                  let bg = palette.bgPanel
                  let border = 'transparent'
                  if (feedback) {
                    if (note === feedback.actual) {
                      bg = '#2d4a3a'
                      border = '#4caf7d'
                    } else if (note === feedback.guessed && !feedback.correct) {
                      bg = '#4a2d2d'
                      border = palette.red
                    }
                  }
                  return (
                    <button
                      key={note}
                      onClick={() => handleGuess(note)}
                      disabled={!awaitingGuess}
                      style={{
                        background: bg,
                        border: `1px solid ${border}`,
                        color: awaitingGuess || feedback ? palette.text : '#5a5f70',
                        borderRadius: '10px',
                        padding: '14px 0',
                        fontWeight: 600,
                        fontSize: '1rem',
                        minWidth: 0,
                      }}
                      className="ear-note-button"
                    >
                      {note}
                    </button>
                  )
                })}
              </div>

              {feedback && (
                <div className="toast ear-feedback" style={{ color: feedback.correct ? '#7fd9a8' : palette.red, fontSize: '0.95rem', lineHeight: 1.45 }}>
                  {feedback.correct
                    ? `Richtig · ${feedback.actual} (${TONE_STYLES[feedback.toneStyle].label})`
                    : `Gehört war ${feedback.actual} (${TONE_STYLES[feedback.toneStyle].label}) · geraten: ${feedback.guessed}`}
                </div>
              )}
            </>
          ) : (
            <div className="ear-session-panel">
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '1.2rem' }}>Session beendet</div>
              <div className="ear-session-copy" style={{ color: palette.textDim, fontSize: '0.95rem', lineHeight: 1.6 }}>
                {sessionCorrect} von {sessionGuesses} richtig ({accuracy}%)
                <br />
                Übung {levelIdx + 1} / {LEVEL_COUNT} · Abschnitt {sectionIdx + 1} / {SECTION_COUNT}
                <br />
                Beste Serie insgesamt: {bestStreak}
              </div>
              <button
                onClick={newSession}
                style={{ background: palette.gold, color: '#1c1a10', borderRadius: '999px', padding: '10px 22px', fontWeight: 600, border: 'none' }}
                className="ear-button"
              >
                Neue Session starten
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}