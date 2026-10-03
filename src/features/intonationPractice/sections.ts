import { transposeNotes } from './notes'
import type { Section, Transposition } from './types'

export const DEFAULT_RANDOM_LENGTH = 10

export function generateSections(
  notes: readonly number[],
  options: { randomLength?: number; random?: () => number } = {},
): Section[] {
  const { randomLength = DEFAULT_RANDOM_LENGTH, random = Math.random } = options
  const uniqueNotes = [...new Set(notes)]

  const pairKeys = new Set<string>()
  const pairs: number[][] = []
  for (let i = 0; i < notes.length - 1; i++) {
    const key = `${notes[i]}:${notes[i + 1]}`
    if (notes[i] === notes[i + 1] || pairKeys.has(key)) continue
    pairKeys.add(key)
    pairs.push([notes[i], notes[i + 1]])
  }

  const randomSteps: number[] = []
  for (let i = 0; i < randomLength; i++) {
    randomSteps.push(uniqueNotes[Math.floor(random() * uniqueNotes.length)])
  }

  const sections: Section[] = [
    { kind: 'single', title: 'Einzeltöne', steps: uniqueNotes.map((note) => [note]) },
  ]
  if (pairs.length > 0) sections.push({ kind: 'pairs', title: 'Tonwechsel', steps: pairs })
  if (uniqueNotes.length > 1) {
    sections.push({ kind: 'random', title: `${randomLength} zufällige Töne`, steps: [randomSteps] })
  }
  sections.push({ kind: 'original', title: 'Tonfolge', steps: [[...notes]] })
  return sections
}

export const MAX_TRANSPOSE = 4
export const TRANSPOSITION_OPTIONS: Transposition[] = [
  ...Array.from({ length: 2 * MAX_TRANSPOSE + 1 }, (_, i) => i - MAX_TRANSPOSE),
  'random',
]
const RANDOM_TRANSPOSE_RANGE = { min: -6, max: 5 }

// Bei 'random' wird eine Tonhöhe innerhalb einer Oktave gewählt.
export function resolveTransposition(
  transpose: Transposition,
  random: () => number = Math.random,
): number {
  if (transpose !== 'random') return transpose
  const { min, max } = RANDOM_TRANSPOSE_RANGE
  return min + Math.floor(random() * (max - min + 1))
}

export function getPlayableNotes(
  notes: readonly number[],
  transpose: Transposition,
  random: () => number = Math.random,
): number[] {
  return transposeNotes(notes, resolveTransposition(transpose, random))
}
