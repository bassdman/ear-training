import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { formatNote, parseNoteSequence } from '../../features/intonationPractice/notes'
import {
  generateSections,
  getPlayableNotes,
  TRANSPOSITION_OPTIONS,
} from '../../features/intonationPractice/sections'
import { loadExercises, saveExercises } from '../../features/intonationPractice/storage'
import type { Exercise, Transposition } from '../../features/intonationPractice/types'
import './intonationExercisesPage.css'

const formatSteps = (steps: number[][]) =>
  steps.map((step) => step.map(formatNote).join('–')).join(' | ')

const formatTranspose = (transpose: Transposition) =>
  transpose === 'random' ? 'Zufall' : `${transpose > 0 ? '+' : ''}${transpose}`

function ExerciseItem({ exercise, onDelete }: { exercise: Exercise; onDelete: () => void }) {
  const [transpose, setTranspose] = useState<Transposition>(0)
  const sections = useMemo(() => generateSections(exercise.notes), [exercise.notes])

  return (
    <li className="ie-item">
      <div className="ie-item-head">
        <div>
          <strong>{exercise.name}</strong>
          <span className="ie-notes">{exercise.notes.map(formatNote).join(' ')}</span>
        </div>
        <button type="button" className="ie-delete" onClick={onDelete}>
          Löschen
        </button>
      </div>

      <details>
        <summary>Abschnitte</summary>
        <ol className="ie-sections">
          {sections.map((section) => (
            <li key={section.kind}>
              <span className="ie-section-title">{section.title}</span>
              <span>{formatSteps(section.steps)}</span>
            </li>
          ))}
        </ol>
      </details>

      <div className="ie-transpose" role="radiogroup" aria-label={`Transponieren ${exercise.name}`}>
        <span>Transponieren</span>
        {TRANSPOSITION_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === transpose}
            className={option === transpose ? 'is-selected' : ''}
            onClick={() => setTranspose(option)}
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

export function IntonationExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>(loadExercises)
  const [name, setName] = useState('')
  const [sequence, setSequence] = useState('')
  const [error, setError] = useState<string | null>(null)

  const update = (next: Exercise[]) => {
    setExercises(next)
    saveExercises(next)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseNoteSequence(sequence)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }

    update([
      ...exercises,
      {
        id: crypto.randomUUID(),
        name: name.trim() || parsed.notes.map(formatNote).join(' '),
        notes: parsed.notes,
      },
    ])
    setName('')
    setSequence('')
    setError(null)
  }

  return (
    <main className="ie-page">
      <div className="ie-shell">
        <Link className="ie-back" to="/">
          Zurück
        </Link>
        <h1>Intonationsübungen</h1>

        <form className="ie-form" onSubmit={handleSubmit}>
          <label>
            Name (optional)
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Tonfolge mit Tonhöhe
            <input
              value={sequence}
              onChange={(event) => setSequence(event.target.value)}
              placeholder="c4 e4 d4 c4"
              aria-describedby="ie-sequence-hint"
            />
          </label>
          <p id="ie-sequence-hint" className="ie-hint">
            Töne: c cis d dis e f fis g gis a ais h, optional mit Oktave (ohne Angabe: 4).
          </p>
          {error && (
            <p className="ie-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit">Übung hinzufügen</button>
        </form>

        {exercises.length === 0 ? (
          <p className="ie-hint">Noch keine Übungen.</p>
        ) : (
          <ul className="ie-list" aria-label="Übungen">
            {exercises.map((exercise) => (
              <ExerciseItem
                key={exercise.id}
                exercise={exercise}
                onDelete={() => update(exercises.filter((entry) => entry.id !== exercise.id))}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
