import { transposeNotes } from './notes'
import type { Section, Step, SyllableMode, Transposition } from './types'

export const DEFAULT_RANDOM_LENGTH = 10

// Mischt den Pool und füllt bei Bedarf mit weiteren Durchgängen auf, damit Silben möglichst nicht doppelt vorkommen.
export function pickSyllables(
  count: number,
  pool: readonly string[],
  random: () => number = Math.random,
): string[] {
  if (pool.length === 0) return []

  const picked: string[] = []
  while (picked.length < count) {
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    picked.push(...shuffled)
  }
  return picked.slice(0, count)
}

export function generateSections(
  notes: readonly number[],
  options: {
    randomLength?: number
    random?: () => number
    syllableMode?: SyllableMode
    syllablePool?: readonly string[]
  } = {},
): Section[] {
  const {
    randomLength = DEFAULT_RANDOM_LENGTH,
    random = Math.random,
    syllableMode = { mode: 'off' },
    syllablePool = [],
  } = options
  const withSyllables = (stepNotes: number[]): Step => {
    if (syllableMode.mode === 'fixed') {
      return { notes: stepNotes, syllables: stepNotes.map(() => syllableMode.syllable) }
    }
    if (syllableMode.mode === 'random' && syllablePool.length > 0) {
      return { notes: stepNotes, syllables: pickSyllables(stepNotes.length, syllablePool, random) }
    }
    return { notes: stepNotes }
  }
  const stepAt = (...indices: number[]): Step => withSyllables(indices.map((index) => notes[index]))

  const uniqueNotes = [...new Set(notes)]
  const singles = uniqueNotes.map((note) => stepAt(notes.indexOf(note)))

  const pairKeys = new Set<string>()
  const pairs: Step[] = []
  for (let i = 0; i < notes.length - 1; i++) {
    const key = `${notes[i]}:${notes[i + 1]}`
    if (notes[i] === notes[i + 1] || pairKeys.has(key)) continue
    pairKeys.add(key)
    pairs.push(stepAt(i, i + 1))
  }

  const randomNotes: number[] = []
  for (let i = 0; i < randomLength; i++) {
    randomNotes.push(uniqueNotes[Math.floor(random() * uniqueNotes.length)])
  }

  const sections: Section[] = [{ kind: 'single', title: 'Einzeltöne', steps: singles }]
  if (pairs.length > 0) sections.push({ kind: 'pairs', title: 'Tonwechsel', steps: pairs })
  sections.push({ kind: 'original', title: 'Tonfolge', steps: [stepAt(...notes.keys())] })
  if (uniqueNotes.length > 1) {
    sections.push({
      kind: 'random',
      title: `${randomLength} zufällige Töne`,
      steps: [withSyllables(randomNotes)],
    })
  }
  return sections
}

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
