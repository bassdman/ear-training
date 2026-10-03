import type { Exercise } from './types'

export const INTONATION_PRACTICE_STORAGE_KEY = 'ear-training-intonation-practice-v1'

function isExercise(value: unknown): value is Exercise {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Exercise>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.notes) &&
    candidate.notes.every((note) => typeof note === 'number')
  )
}

export function loadExercises(): Exercise[] {
  try {
    const stored = window.localStorage.getItem(INTONATION_PRACTICE_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isExercise) : []
  } catch {
    return []
  }
}

export function saveExercises(exercises: Exercise[]): void {
  try {
    window.localStorage.setItem(INTONATION_PRACTICE_STORAGE_KEY, JSON.stringify(exercises))
  } catch {
    // Speicherfehler ignorieren
  }
}
