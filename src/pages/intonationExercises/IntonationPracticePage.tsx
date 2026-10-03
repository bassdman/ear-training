import { Fragment, useEffect, useMemo, useState } from 'react'
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
import type { Exercise, Step, SyllableMode } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'
import {
  decodeSyllableMode,
  encodeSyllableMode,
} from '../../features/intonationPractice/syllables'

const describeStep = (step: Step) =>
  step.notes
    .map((note, index) => [formatNote(note), step.syllables?.[index]].filter(Boolean).join(' '))
    .join(', ')

function StepLabel({ step }: { step: Step }) {
  return step.notes.map((note, index) => (
    <Fragment key={index}>
      {index > 0 && <span className="ie-step-dash">–</span>}
      <span className="ie-step-note">
        <span>{formatNote(note)}</span>
        {step.syllables && <small>{step.syllables[index]}</small>}
      </span>
    </Fragment>
  ))
}

type ExerciseItemProps = {
  exercise: Exercise
  transpose: number
  initialSyllableMode?: SyllableMode
  onPlay: (notes: number[]) => void
}

function ExerciseItem({
  exercise,
  transpose,
  initialSyllableMode = { mode: 'off' },
  onPlay,
}: ExerciseItemProps) {
  const [shuffleCount, setShuffleCount] = useState(0)
  const [syllableMode, setSyllableMode] = useState<SyllableMode>(initialSyllableMode)
  const notes = useMemo(
    () => transposeNotes(exercise.notes, transpose),
    [exercise.notes, transpose],
  )
  // shuffleCount erzwingt eine neue Zufallsreihenfolge.
  const sections = useMemo(
    () =>
      generateSections(notes, {
        syllableMode,
        syllablePool: randomSyllables,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, syllableMode, shuffleCount],
  )
  const flatSteps = useMemo(
    () =>
      sections.flatMap((section) =>
        section.steps.map((step) => ({ kind: section.kind, title: section.title, step })),
      ),
    [sections],
  )
  // Anzahl der abgehakten Schritte; nur der nächste offene Schritt ist sichtbar.
  const [doneCount, setDoneCount] = useState(0)
  const visibleSteps = flatSteps.slice(0, doneCount + 1)
  const isComplete = doneCount >= flatSteps.length

  return (
    <li className={`ie-item ${isComplete ? 'is-complete' : ''}`}>
      <div className="ie-item-head">
        <div>
          <strong>{exercise.name}</strong>
          <span className="ie-notes">{notes.map(formatNote).join(' ')}</span>
        </div>
        <label className="ie-syllable-select">
          Silbe
          <select
            value={encodeSyllableMode(syllableMode)}
            onChange={(event) => setSyllableMode(decodeSyllableMode(event.target.value))}
          >
            <option value="off">Aus</option>
            <option value="random">Zufällig</option>
            {randomSyllables.map((syllable) => (
              <option key={syllable} value={`fixed:${syllable}`}>
                {syllable}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="ie-sections">
        {visibleSteps.map((entry, index) => {
          const label = describeStep(entry.step)
          const isDone = index < doneCount
          const isFirstOfSection = index === 0 || visibleSteps[index - 1].title !== entry.title
          const canToggle = index === doneCount || index === doneCount - 1

          return (
            <li key={index} className={isDone ? 'is-done' : ''}>
              <span className="ie-section-title">{isFirstOfSection ? entry.title : ''}</span>
              <span className="ie-steps">
                <button
                  type="button"
                  className="ie-step"
                  aria-label={`${entry.title} abspielen: ${label}`}
                  onClick={() => onPlay(entry.step.notes)}
                >
                  <StepLabel step={entry.step} />
                </button>
                {entry.kind === 'random' && (
                  <button
                    type="button"
                    className="ie-step ie-shuffle"
                    aria-label="Zufällige Töne neu mischen"
                    title="Neu mischen"
                    onClick={() => setShuffleCount((count) => count + 1)}
                  >
                    ↻
                  </button>
                )}
                <button
                  type="button"
                  className="ie-done"
                  aria-label={`${label} geschafft`}
                  aria-pressed={isDone}
                  disabled={!canToggle}
                  onClick={() => setDoneCount(isDone ? index : index + 1)}
                >
                  ✓
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {isComplete && <p className="ie-hint">Alle Schritte geschafft.</p>}
    </li>
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

  const handlePlay = (notes: number[]) => void play(notes)

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
      {playError && (
        <p className="ie-error" role="alert">
          {playError}
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
                  />
                ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
