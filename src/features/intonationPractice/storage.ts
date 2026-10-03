import { DEFAULT_EXERCISES } from './defaultExercises'
import { DEFAULT_SONGS } from './defaultSongs'
import { DEFAULT_NOTE_RANGE, isValidRange, type NoteRange } from './range'
import type { Exercise, Song, SongNote } from './types'

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

export const INTONATION_SONGS_STORAGE_KEY = 'ear-training-intonation-songs-v1'

function isSongNote(value: unknown): value is SongNote {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SongNote>
  return (
    (candidate.note === null || typeof candidate.note === 'number') &&
    typeof candidate.text === 'string'
  )
}

function isSong(value: unknown): value is Song {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Song>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.lines) &&
    candidate.lines.every((line) => Array.isArray(line) && line.every(isSongNote))
  )
}

export function loadSongs(): Song[] {
  try {
    const stored = window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isSong) : []
  } catch {
    return []
  }
}

export function saveSongs(songs: Song[]): void {
  try {
    window.localStorage.setItem(INTONATION_SONGS_STORAGE_KEY, JSON.stringify(songs))
  } catch {
    // Speicherfehler ignorieren
  }
}

export function loadAllSongs(): Song[] {
  return [...DEFAULT_SONGS, ...loadSongs()]
}
