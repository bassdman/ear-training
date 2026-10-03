import { beforeEach, describe, expect, it } from 'vitest'

import { formatNote, parseNote, parseNoteSequence, transposeNotes } from './notes'
import {
  generateSections,
  getPlayableNotes,
  resolveTransposition,
  TRANSPOSITION_OPTIONS,
} from './sections'
import { loadExercises, saveExercises } from './storage'

describe('notes', () => {
  it('parst Töne mit und ohne Oktave', () => {
    expect(parseNote('c4')).toBe(60)
    expect(parseNote('c')).toBe(60)
    expect(parseNote('Fis3')).toBe(54)
    expect(parseNote('h')).toBe(71)
    expect(parseNote('x')).toBeNull()
  })

  it('formatiert Töne', () => {
    expect(formatNote(60)).toBe('c4')
    expect(formatNote(61)).toBe('cis4')
    expect(formatNote(59)).toBe('h3')
  })

  it('parst Tonfolgen und meldet Fehler', () => {
    expect(parseNoteSequence('c e d c')).toEqual({ notes: [60, 64, 62, 60] })
    expect(parseNoteSequence('c-e-d')).toEqual({ notes: [60, 64, 62] })
    expect(parseNoteSequence('c q')).toEqual({ error: 'Unbekannter Ton: "q"' })
    expect(parseNoteSequence('  ')).toHaveProperty('error')
  })

  it('transponiert', () => {
    expect(transposeNotes([60, 64], 2)).toEqual([62, 66])
  })
})

describe('generateSections', () => {
  it('erzeugt Einzeltöne, Tonwechsel, Zufall und Tonfolge', () => {
    const sections = generateSections([60, 64, 62, 60], { randomLength: 5, random: () => 0 })

    expect(sections.map((section) => section.kind)).toEqual(['single', 'pairs', 'random', 'original'])
    expect(sections[0].steps).toEqual([[60], [64], [62]])
    expect(sections[1].steps).toEqual([[60, 64], [64, 62], [62, 60]])
    expect(sections[2].steps).toEqual([[60, 60, 60, 60, 60]])
    expect(sections[3].steps).toEqual([[60, 64, 62, 60]])
  })

  it('lässt Tonwechsel und Zufall bei einem einzelnen Ton weg', () => {
    const sections = generateSections([60])
    expect(sections.map((section) => section.kind)).toEqual(['single', 'original'])
  })

  it('überspringt doppelte und gleiche Paare', () => {
    const sections = generateSections([60, 60, 64, 60, 64])
    expect(sections[1].steps).toEqual([[60, 64], [64, 60]])
  })
})

describe('Transposition', () => {
  const notes = [60, 64]

  it('bietet -4 bis +4 und Zufall an', () => {
    expect(TRANSPOSITION_OPTIONS).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 'random'])
  })

  it('transponiert fest um den gewählten Wert', () => {
    expect(getPlayableNotes(notes, -2)).toEqual([58, 62])
  })

  it('wählt bei Zufall eine Tonhöhe innerhalb einer Oktave', () => {
    expect(resolveTransposition('random', () => 0)).toBe(-6)
    expect(resolveTransposition('random', () => 0.999)).toBe(5)
    expect(getPlayableNotes(notes, 'random', () => 0)).toEqual([54, 58])
  })
})

describe('storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('speichert und lädt Übungen und ignoriert kaputte Daten', () => {
    const exercise = { id: '1', name: 'Intro', notes: [60, 64] }
    saveExercises([exercise])
    expect(loadExercises()).toEqual([exercise])

    window.localStorage.setItem('ear-training-intonation-practice-v1', '{kaputt')
    expect(loadExercises()).toEqual([])
  })
})
