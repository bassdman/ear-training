import { DEFAULT_EXERCISES } from './defaultExercises'
import { DEFAULT_NOTE_RANGE, isValidRange, type NoteRange } from './range'
import type { Exercise } from './types'

export const INTONATION_PRACTICE_STORAGE_KEY = 'ear-training-intonation-practice-v1'
export const INTONATION_RANGE_STORAGE_KEY = 'ear-training-intonation-range-v1'

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

export function loadAllExercises(): Exercise[] {
  return [...DEFAULT_EXERCISES, ...loadExercises()]
}

export function loadRange(): NoteRange {
  try {
    const stored = window.localStorage.getItem(INTONATION_RANGE_STORAGE_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null
    return isValidRange(parsed) ? { min: parsed.min, max: parsed.max } : DEFAULT_NOTE_RANGE
  } catch {
    return DEFAULT_NOTE_RANGE
  }
}

export function saveRange(range: NoteRange): void {
  try {
    window.localStorage.setItem(INTONATION_RANGE_STORAGE_KEY, JSON.stringify(range))
  } catch {
    // Speicherfehler ignorieren
  }
}

export function saveExercises(exercises: Exercise[]): void {
  try {
    window.localStorage.setItem(INTONATION_PRACTICE_STORAGE_KEY, JSON.stringify(exercises))
  } catch {
    // Speicherfehler ignorieren
  }
}
