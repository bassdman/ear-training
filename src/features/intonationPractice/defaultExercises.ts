import defaultExerciseConfig from './config/defaultExercises.json'
import { parseNoteSequence } from './notes'
import type { Exercise } from './types'

export const DEFAULT_EXERCISES: Exercise[] = defaultExerciseConfig.map(
  ({ id, name, sequence }) => {
    const parsed = parseNoteSequence(sequence)
    if ('error' in parsed) throw new Error(`Standardübung "${name}": ${parsed.error}`)
    return { id, name, notes: parsed.notes }
  },
)
