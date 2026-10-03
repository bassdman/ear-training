import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  formatNote,
  PITCH_CLASS_LABELS,
  shiftToPitchClass,
  transposeNotes,
} from '../../features/intonationPractice/notes'
import { generateSections, resolveTransposition } from '../../features/intonationPractice/sections'
import { loadExercises } from '../../features/intonationPractice/storage'
import type { Exercise } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'

type ExerciseItemProps = {
  exercise: Exercise
  transpose: number
  onPlay: (notes: number[]) => void
}

function ExerciseItem({ exercise, transpose, onPlay }: ExerciseItemProps) {
  const [shuffleCount, setShuffleCount] = useState(0)
  const notes = useMemo(
    () => transposeNotes(exercise.notes, transpose),
    [exercise.notes, transpose],
  )
  // shuffleCount erzwingt eine neue Zufallsreihenfolge.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sections = useMemo(() => generateSections(notes), [notes, shuffleCount])
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
      </div>

      <ol className="ie-sections">
        {visibleSteps.map((entry, index) => {
          const label = entry.step.map(formatNote).join('–')
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
                  onClick={() => onPlay(entry.step)}
                >
                  {label}
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

export function IntonationPracticePage() {
  const [exercises] = useState<Exercise[]>(loadExercises)
  const [randomPick, setRandomPick] = useState<RandomPick | null>(null)
  const [openPitch, setOpenPitch] = useState<number | null>(null)
  const { play, error: playError } = usePlayNotes()

  useEffect(() => {
    if (openPitch === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPitch(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openPitch])

  const handlePlay = (notes: number[]) => void play(notes)

  const drawRandom = () =>
    setRandomPick((previous) => ({
      id: (previous?.id ?? 0) + 1,
      exercise: exercises[Math.floor(Math.random() * exercises.length)],
      transpose: resolveTransposition('random'),
    }))

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

      <section className="ie-random" aria-label="Zufallsübung">
        {randomPick ? (
          <>
            <ul className="ie-list">
              <ExerciseItem
                key={randomPick.id}
                exercise={randomPick.exercise}
                transpose={randomPick.transpose}
                onPlay={handlePlay}
              />
            </ul>
            <button type="button" className="ie-random-button is-small" onClick={drawRandom}>
              Neue Zufallsübung
            </button>
          </>
        ) : (
          <button type="button" className="ie-random-button" onClick={drawRandom}>
            Zufallsübung aufdecken
          </button>
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
                onClick={() => setOpenPitch(pitchClass)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {openPitch !== null && (
        <div className="ie-overlay" onClick={() => setOpenPitch(null)}>
          <div
            className="ie-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Übungen ab ${PITCH_CLASS_LABELS[openPitch]}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ie-overlay-head">
              <h2>Start auf {PITCH_CLASS_LABELS[openPitch]}</h2>
              <button type="button" className="ie-overlay-close" onClick={() => setOpenPitch(null)}>
                Schließen
              </button>
            </div>
            <ul className="ie-list">
              {exercises.map((exercise) => (
                <ExerciseItem
                  key={`${openPitch}-${exercise.id}`}
                  exercise={exercise}
                  transpose={shiftToPitchClass(exercise.notes[0], openPitch)}
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
