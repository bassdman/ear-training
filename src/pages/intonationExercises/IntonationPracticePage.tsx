import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatNote } from '../../features/intonationPractice/notes'
import {
  generateSections,
  getPlayableNotes,
  resolveTransposition,
  TRANSPOSITION_OPTIONS,
} from '../../features/intonationPractice/sections'
import { loadExercises } from '../../features/intonationPractice/storage'
import type { Exercise, Transposition } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'

const formatTranspose = (transpose: Transposition) =>
  transpose === 'random' ? 'Zufall' : `${transpose > 0 ? '+' : ''}${transpose}`

type ExerciseItemProps = {
  exercise: Exercise
  onPlay: (notes: number[]) => void
}

function ExerciseItem({ exercise, onPlay }: ExerciseItemProps) {
  const [transpose, setTranspose] = useState<Transposition>(0)
  const [shuffleCount, setShuffleCount] = useState(0)
  // Bei Zufall wird die Anzeige im Original belassen und erst beim Abspielen verschoben.
  const displayNotes = useMemo(
    () => (transpose === 'random' ? exercise.notes : getPlayableNotes(exercise.notes, transpose)),
    [exercise.notes, transpose],
  )
  // shuffleCount erzwingt eine neue Zufallsreihenfolge.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sections = useMemo(() => generateSections(displayNotes), [displayNotes, shuffleCount])
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

  const selectTranspose = (option: Transposition) => {
    setTranspose(option)
    setDoneCount(0)
  }

  const playStep = (step: number[]) => {
    const shift = transpose === 'random' ? resolveTransposition('random') : 0
    onPlay(step.map((note) => note + shift))
  }

  return (
    <li className={`ie-item ${isComplete ? 'is-complete' : ''}`}>
      <div className="ie-item-head">
        <div>
          <strong>{exercise.name}</strong>
          <span className="ie-notes">{exercise.notes.map(formatNote).join(' ')}</span>
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
                  onClick={() => playStep(entry.step)}
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

      <div className="ie-transpose" role="radiogroup" aria-label={`Transponieren ${exercise.name}`}>
        <span>Transponieren</span>
        {TRANSPOSITION_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === transpose}
            className={option === transpose ? 'is-selected' : ''}
            onClick={() => selectTranspose(option)}
          >
            {formatTranspose(option)}
          </button>
        ))}
      </div>
      <p className="ie-hint">
        {transpose === 'random'
          ? 'Beliebige Tonhöhe bei jedem Durchgang'
          : getPlayableNotes(exercise.notes, transpose).map(formatNote).join(' ')}
      </p>
    </li>
  )
}

export function IntonationPracticePage() {
  const [exercises] = useState<Exercise[]>(loadExercises)
  const { play, error: playError } = usePlayNotes()

  return (
    <>
      {playError && (
        <p className="ie-error" role="alert">
          {playError}
        </p>
      )}

      {exercises.length === 0 ? (
        <p className="ie-hint">
          Noch keine Übungen. <Link to="/intonation-exercises/create">Übung erstellen</Link>
        </p>
      ) : (
        <ul className="ie-list" aria-label="Übungen">
          {exercises.map((exercise) => (
            <ExerciseItem key={exercise.id} exercise={exercise} onPlay={(notes) => void play(notes)} />
          ))}
        </ul>
      )}
    </>
  )
}
