import { beforeEach, describe, expect, it } from 'vitest'

import {
  formatNote,
  parseNote,
  parseNoteSequence,
  shiftToPitchClass,
  transposeNotes,
} from './notes'
import { generateSections, getPlayableNotes, resolveTransposition } from './sections'
import { loadAllExercises, loadExercises, saveExercises } from './storage'
import { DEFAULT_EXERCISES } from './defaultExercises'

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

    expect(sections.map((section) => section.kind)).toEqual(['single', 'pairs', 'original', 'random'])
    expect(sections[0].steps).toEqual([[60], [64], [62]])
    expect(sections[1].steps).toEqual([[60, 64], [64, 62], [62, 60]])
    expect(sections[2].steps).toEqual([[60, 64, 62, 60]])
    expect(sections[3].steps).toEqual([[60, 60, 60, 60, 60]])
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

  it('legt den ersten Ton auf die gewählte Tonklasse (kleinste Verschiebung)', () => {
    expect(shiftToPitchClass(60, 0)).toBe(0)
    expect(shiftToPitchClass(60, 2)).toBe(2)
    expect(shiftToPitchClass(60, 7)).toBe(-5)
    expect(shiftToPitchClass(64, 0)).toBe(-4)
    expect(shiftToPitchClass(60, 6)).toBe(-6)
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

  it('enthält Standardübungen mit je drei Tönen', () => {
    expect(DEFAULT_EXERCISES.map((entry) => [entry.name, entry.notes])).toEqual([
      ['Dur-Dreiklang', [60, 64, 67]],
      ['Moll-Dreiklang', [60, 63, 67]],
      ['Halbtonschritte', [60, 61, 62]],
    ])
  })

  it('liefert Standardübungen vor den eigenen Übungen', () => {
    const own = { id: 'own', name: 'Eigene', notes: [60, 62] }
    saveExercises([own])
    expect(loadAllExercises()).toEqual([...DEFAULT_EXERCISES, own])
    expect(loadExercises()).toEqual([own])
  })

  it('speichert und lädt Übungen und ignoriert kaputte Daten', () => {
    const exercise = { id: '1', name: 'Intro', notes: [60, 64] }
    saveExercises([exercise])
    expect(loadExercises()).toEqual([exercise])

    window.localStorage.setItem('ear-training-intonation-practice-v1', '{kaputt')
    expect(loadExercises()).toEqual([])
  })
})
