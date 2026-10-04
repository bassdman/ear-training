import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import randomSyllables from '../../features/intonationPractice/config/randomSyllables.json'
import {
  formatNote,
  PITCH_CLASS_LABELS,
  transposeNotes,
} from '../../features/intonationPractice/notes'
import {
  NOTE_RANGE_BOUNDS,
  startNotesInRange,
  type NoteRange,
} from '../../features/intonationPractice/range'
import { generateSections } from '../../features/intonationPractice/sections'
import {
  loadAllExercises,
  loadRange,
  saveRange,
} from '../../features/intonationPractice/storage'
import type { Exercise, SyllableMode } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'
import { PracticeCard } from './PracticeCard'
import { useSingStep, type SingController } from './useSingStep'

type ExerciseItemProps = {
  exercise: Exercise
  transpose: number
  initialSyllableMode?: SyllableMode
  onPlay: (notes: (number | null)[]) => void
  sing: SingController
}

function ExerciseItem({
  exercise,
  transpose,
  initialSyllableMode = { mode: 'off' },
  onPlay,
  sing,
}: ExerciseItemProps) {
  const [shuffleCount, setShuffleCount] = useState(0)
  const [syllableMode, setSyllableMode] = useState<SyllableMode>(initialSyllableMode)
  const notes = useMemo(
    () => transposeNotes(exercise.notes, transpose),
    [exercise.notes, transpose],
  )
  // shuffleCount erzwingt eine neue Zufallsreihenfolge.
  const sections = useMemo(
    () => generateSections(notes, { syllableMode, syllablePool: randomSyllables }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, syllableMode, shuffleCount],
  )

  return (
    <PracticeCard
      title={exercise.name}
      subtitle={notes.map(formatNote).join(' ')}
      sections={sections}
      syllableMode={syllableMode}
      onSyllableModeChange={setSyllableMode}
      onShuffle={() => setShuffleCount((count) => count + 1)}
      onPlay={onPlay}
      sing={sing}
    />
  )
}

type RandomPick = { id: number; exercise: Exercise; transpose: number }

const NOTE_OPTIONS = Array.from(
  { length: NOTE_RANGE_BOUNDS.max - NOTE_RANGE_BOUNDS.min + 1 },
  (_, i) => NOTE_RANGE_BOUNDS.min + i,
)

const pitchClassOf = (midi: number) => ((midi % 12) + 12) % 12
const DEFAULT_START_NOTE = 60

export function IntonationPracticePage() {
  const [exercises] = useState<Exercise[]>(loadAllExercises)
  const [range, setRange] = useState<NoteRange>(loadRange)
  const [randomPick, setRandomPick] = useState<RandomPick | null>(null)
  const [openStart, setOpenStart] = useState<number | null>(null)
  const { play, error: playError } = usePlayNotes()
  const sing = useSingStep()

  // Alle Übungen mit jedem Startton, bei dem sie komplett in der Range liegen.
  const placements = useMemo(
    () =>
      exercises.flatMap((exercise) =>
        startNotesInRange(exercise.notes, range).map((start) => ({
          exercise,
          start,
          shift: start - exercise.notes[0],
        })),
      ),
    [exercises, range],
  )
  const startsByPitchClass = useMemo(() => {
    const groups: number[][] = PITCH_CLASS_LABELS.map(() => [])
    for (const start of [...new Set(placements.map((entry) => entry.start))].sort((a, b) => a - b)) {
      groups[pitchClassOf(start)].push(start)
    }
    return groups
  }, [placements])

  const updateRange = (next: NoteRange) => {
    setRange(next)
    saveRange(next)
    setRandomPick(null)
  }

  useEffect(() => {
    if (openStart === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenStart(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openStart])

  const handlePlay = (notes: (number | null)[]) => void play(notes)

  const openPitchClass = (pitchClass: number) => {
    const starts = startsByPitchClass[pitchClass]
    // Vorauswahl: der Startton, der am nächsten an c4 liegt.
    setOpenStart(
      starts.reduce((best, start) =>
        Math.abs(start - DEFAULT_START_NOTE) < Math.abs(best - DEFAULT_START_NOTE) ? start : best,
      ),
    )
  }

  const drawRandom = () => {
    const pick = placements[Math.floor(Math.random() * placements.length)]
    setRandomPick((previous) => ({
      id: (previous?.id ?? 0) + 1,
      exercise: pick.exercise,
      transpose: pick.shift,
    }))
  }

  if (exercises.length === 0) {
    return (
      <p className="ie-hint">
        Noch keine Übungen. <Link to="/intonation-exercises/create">Übung erstellen</Link>
      </p>
    )
  }

  return (
    <>
      {(playError || sing.error) && (
        <p className="ie-error" role="alert">
          {playError ?? sing.error}
        </p>
      )}

      <section className="ie-range" aria-label="Stimmumfang">
        <label>
          Tiefster Ton
          <select
            value={range.min}
            onChange={(event) => updateRange({ ...range, min: Number(event.target.value) })}
          >
            {NOTE_OPTIONS.filter((note) => note <= range.max).map((note) => (
              <option key={note} value={note}>
                {formatNote(note)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Höchster Ton
          <select
            value={range.max}
            onChange={(event) => updateRange({ ...range, max: Number(event.target.value) })}
          >
            {NOTE_OPTIONS.filter((note) => note >= range.min).map((note) => (
              <option key={note} value={note}>
                {formatNote(note)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="ie-random" aria-label="Zufallsübung">
        {randomPick ? (
          <>
            <ul className="ie-list">
              <ExerciseItem
                key={randomPick.id}
                exercise={randomPick.exercise}
                transpose={randomPick.transpose}
                initialSyllableMode={{ mode: 'random' }}
                onPlay={handlePlay}
                sing={sing}
              />
            </ul>
            <button type="button" className="ie-random-button is-small" onClick={drawRandom}>
              Neue Zufallsübung
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ie-random-button"
            disabled={placements.length === 0}
            onClick={drawRandom}
          >
            Zufallsübung aufdecken
          </button>
        )}
        {placements.length === 0 && (
          <p className="ie-hint">Keine Übung passt in diesen Tonumfang.</p>
        )}
      </section>

      <section aria-label="Tonhöhen">
        <h2 className="ie-heading">Tonhöhen</h2>
        <ul className="ie-pitch-grid">
          {PITCH_CLASS_LABELS.map((label, pitchClass) => (
            <li key={label}>
              <button
                type="button"
                className="ie-pitch-toggle"
                aria-haspopup="dialog"
                disabled={startsByPitchClass[pitchClass].length === 0}
                onClick={() => openPitchClass(pitchClass)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {openStart !== null && (
        <div className="ie-overlay" onClick={() => setOpenStart(null)}>
          <div
            className="ie-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Übungen ab ${PITCH_CLASS_LABELS[pitchClassOf(openStart)]}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ie-overlay-head">
              <h2>Start auf {formatNote(openStart)}</h2>
              <button type="button" className="ie-overlay-close" onClick={() => setOpenStart(null)}>
                Schließen
              </button>
            </div>
            <div className="ie-start-select" role="group" aria-label="Startton">
              {startsByPitchClass[pitchClassOf(openStart)].map((start) => (
                <button
                  key={start}
                  type="button"
                  aria-pressed={start === openStart}
                  onClick={() => setOpenStart(start)}
                >
                  {formatNote(start)}
                </button>
              ))}
            </div>
            <ul className="ie-list">
              {placements
                .filter((entry) => entry.start === openStart)
                .map(({ exercise, shift }) => (
                  <ExerciseItem
                    key={`${openStart}-${exercise.id}`}
                    exercise={exercise}
                    transpose={shift}
                    onPlay={handlePlay}
                    sing={sing}
                  />
                ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
