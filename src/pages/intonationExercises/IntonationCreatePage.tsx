import { useState, type FormEvent } from 'react'

import { formatNote, parseNoteSequence } from '../../features/intonationPractice/notes'
import { loadExercises, saveExercises } from '../../features/intonationPractice/storage'
import type { Exercise } from '../../features/intonationPractice/types'
import { SongCreateSection } from './SongCreateSection'

export function IntonationCreatePage() {
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
    <>
      <h2 className="ie-heading">Übung anlegen</h2>
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
        <ul className="ie-list" aria-label="Angelegte Übungen">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="ie-item">
              <div className="ie-item-head">
                <div>
                  <strong>{exercise.name}</strong>
                  <span className="ie-notes">{exercise.notes.map(formatNote).join(' ')}</span>
                </div>
                <button
                  type="button"
                  className="ie-delete"
                  onClick={() => update(exercises.filter((entry) => entry.id !== exercise.id))}
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SongCreateSection />
    </>
  )
}
