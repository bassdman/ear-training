import { beforeEach, describe, expect, it } from 'vitest'

import {
  formatNote,
  parseNote,
  parseNoteSequence,
  shiftToPitchClass,
  transposeNotes,
} from './notes'
import {
  generateSections,
  getPlayableNotes,
  pickSyllables,
  resolveTransposition,
} from './sections'
import { decodeSyllableMode, encodeSyllableMode } from './syllables'
import { flattenSong, generateSongSections, parseSongInput, sliceSong } from './songs'
import {
  loadAllExercises,
  loadAllSongs,
  loadExercises,
  loadRange,
  loadSongs,
  saveExercises,
  saveRange,
  saveSongs,
} from './storage'
import { DEFAULT_NOTE_RANGE, startNotesInRange } from './range'
import { DEFAULT_EXERCISES } from './defaultExercises'
import { DEFAULT_SONGS } from './defaultSongs'

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
  const stepNotes = (section: { steps: { notes: (number | null)[] }[] }) =>
    section.steps.map((step) => step.notes)

  it('erzeugt Einzeltöne, Tonwechsel, Zufall und Tonfolge', () => {
    const sections = generateSections([60, 64, 62, 60], { randomLength: 5, random: () => 0 })

    expect(sections.map((section) => section.kind)).toEqual(['single', 'pairs', 'original', 'random'])
    expect(stepNotes(sections[0])).toEqual([[60], [64], [62]])
    expect(stepNotes(sections[1])).toEqual([[60, 64], [64, 62], [62, 60]])
    expect(stepNotes(sections[2])).toEqual([[60, 64, 62, 60]])
    expect(stepNotes(sections[3])).toEqual([[60, 60, 60, 60, 60]])
  })

  it('lässt Tonwechsel und Zufall bei einem einzelnen Ton weg', () => {
    const sections = generateSections([60])
    expect(sections.map((section) => section.kind)).toEqual(['single', 'original'])
  })

  it('überspringt doppelte und gleiche Paare', () => {
    const sections = generateSections([60, 60, 64, 60, 64])
    expect(stepNotes(sections[1])).toEqual([[60, 64], [64, 60]])
  })

  it('lässt die Silben standardmäßig aus', () => {
    const sections = generateSections([60, 64, 62], { syllablePool: ['a', 'b'] })
    expect(sections.every((section) => section.steps.every((step) => !step.syllables))).toBe(true)
  })

  it('verwendet bei fester Silbe überall dieselbe', () => {
    const sections = generateSections([60, 64, 62], {
      randomLength: 3,
      syllableMode: { mode: 'fixed', syllable: 'de' },
    })
    expect(sections[0].steps.map((step) => step.syllables)).toEqual([['de'], ['de'], ['de']])
    expect(sections[1].steps[0].syllables).toEqual(['de', 'de'])
    expect(sections[2].steps[0].syllables).toEqual(['de', 'de', 'de'])
    expect(sections[3].steps[0].syllables).toEqual(['de', 'de', 'de'])
  })

  it('nimmt im Zufallsmodus pro Ton verschiedene Silben aus dem Pool', () => {
    const pool = ['a', 'b', 'c', 'd']
    const sections = generateSections([60, 64], {
      randomLength: 4,
      syllableMode: { mode: 'random' },
      syllablePool: pool,
    })
    const randomSection = sections[sections.length - 1].steps[0].syllables!
    expect(new Set(randomSection).size).toBe(4)
    expect(sections[0].steps[0].syllables).toHaveLength(1)
    expect(sections[1].steps[0].syllables).toHaveLength(2)
  })

  it('lässt im Zufallsmodus ohne Pool die Silben weg', () => {
    const sections = generateSections([60, 64], { syllableMode: { mode: 'random' } })
    expect(sections[0].steps[0].syllables).toBeUndefined()
  })
})

describe('pickSyllables', () => {
  it('füllt mit weiteren Durchgängen auf, wenn der Pool zu klein ist', () => {
    const picked = pickSyllables(5, ['a', 'b'])
    expect(picked).toHaveLength(5)
    expect(picked.every((syllable) => ['a', 'b'].includes(syllable))).toBe(true)
  })

  it('liefert ohne Pool nichts', () => {
    expect(pickSyllables(3, [])).toEqual([])
  })
})

describe('Lieder', () => {
  beforeEach(() => window.localStorage.clear())

  it('parst Töne mit Text, ohne Text und Pausen zeilenweise', () => {
    expect(parseSongInput('c4:Al e4 -\n\n g4:gel')).toEqual({
      lines: [
        [
          { note: 60, text: 'Al' },
          { note: 64, text: '' },
          { note: null, text: '' },
        ],
        [{ note: 67, text: 'gel' }],
      ],
    })
  })

  it('meldet Fehler mit Zeilennummer und verlangt mindestens einen Ton', () => {
    expect(parseSongInput('c4:a\nx4:b')).toEqual({ error: 'Zeile 2: Unbekannter Ton "x4"' })
    expect(parseSongInput('  ')).toHaveProperty('error')
    expect(parseSongInput('- -')).toHaveProperty('error')
  })

  it('erzeugt Aufwärmübungen aus allen Tönen und danach den Liedtext', () => {
    const parsed = parseSongInput('c4:Al e4:le - g4:gel\nc4:fliegt')
    if ('error' in parsed) throw new Error(parsed.error)
    const sections = generateSongSections(
      { id: '1', name: 'Lied', lines: parsed.lines },
      { randomLength: 3, random: () => 0 },
    )

    expect(sections.map((section) => section.kind)).toEqual(['single', 'pairs', 'random', 'lyrics'])
    expect(sections[0].steps.map((step) => step.notes)).toEqual([[60], [64], [67]])
    // kein Tonwechsel über Pause oder Zeilenende hinweg
    expect(sections[1].steps.map((step) => step.notes)).toEqual([[60, 64]])
    expect(sections[3].steps).toEqual([
      { notes: [60, 64, null, 67], syllables: ['Al', 'le', '', 'gel'] },
      { notes: [60], syllables: ['fliegt'] },
    ])
  })

  it('wählt einen Ausschnitt über Zeilen hinweg und lässt leere Zeilen weg', () => {
    const parsed = parseSongInput('c4:a d4:b e4:c\nf4:d g4:e\na4:f')
    if ('error' in parsed) throw new Error(parsed.error)
    const song = { id: '1', name: 'Lied', lines: parsed.lines }

    expect(flattenSong(song).map((entry) => [entry.index, entry.line])).toEqual([
      [0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [5, 2],
    ])
    expect(sliceSong(song, { start: 2, end: 4 }).lines.map((line) => line.map((entry) => entry.text))).toEqual([
      ['c'],
      ['d', 'e'],
    ])
    expect(sliceSong(song, { start: 5, end: 5 }).lines).toHaveLength(1)
  })

  it('erzeugt Übungen nur aus dem gewählten Ausschnitt', () => {
    const parsed = parseSongInput('c4:a d4:b e4:c\nf4:d g4:e')
    if ('error' in parsed) throw new Error(parsed.error)
    const song = { id: '1', name: 'Lied', lines: parsed.lines }
    const sections = generateSongSections(sliceSong(song, { start: 1, end: 3 }))

    expect(sections[0].steps.map((step) => step.notes)).toEqual([[62], [64], [65]])
    expect(sections[sections.length - 1].steps.map((step) => step.syllables)).toEqual([
      ['b', 'c'],
      ['d'],
    ])
  })

  it('speichert Lieder und verwirft kaputte Einträge', () => {
    const song = {
      id: '1',
      name: 'Lied',
      lines: [[{ note: 60, text: 'a' }, { note: null, text: '' }]],
    }
    saveSongs([song])
    expect(loadSongs()).toEqual([song])

    window.localStorage.setItem(
      'ear-training-intonation-songs-v1',
      JSON.stringify([song, { id: '2', name: 'x', lines: [[{ note: 'c' }]] }]),
    )
    expect(loadSongs()).toEqual([song])
  })
})

describe('Standardlieder', () => {
  beforeEach(() => window.localStorage.clear())

  it('lädt jede Lieddatei aus config/songs', () => {
    expect(DEFAULT_SONGS.map((song) => song.name)).toContain('Alle meine Entchen')
    const entchen = DEFAULT_SONGS.find((song) => song.id === 'default-alle-meine-entchen')!
    expect(entchen.lines).toHaveLength(5)
    expect(entchen.lines[0].map((entry) => entry.text)).toEqual(['Al', 'le', 'mei', 'ne', 'Ent', 'chen'])
    expect(entchen.lines[0].map((entry) => entry.note)).toEqual([60, 62, 64, 65, 67, 67])
  })

  it('liefert Standardlieder vor den eigenen Liedern', () => {
    const own = { id: 'own', name: 'Eigenes', lines: [[{ note: 60, text: 'a' }]] }
    saveSongs([own])
    expect(loadAllSongs()).toEqual([...DEFAULT_SONGS, own])
    expect(loadSongs()).toEqual([own])
  })
})

describe('syllableMode', () => {
  it('kodiert und dekodiert den Select-Wert', () => {
    const modes = [
      { mode: 'off' },
      { mode: 'random' },
      { mode: 'fixed', syllable: 'de' },
    ] as const
    for (const mode of modes) {
      expect(decodeSyllableMode(encodeSyllableMode(mode))).toEqual(mode)
    }
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

describe('range', () => {
  beforeEach(() => window.localStorage.clear())

  it('liefert alle Starttöne, bei denen die Übung in die Range passt', () => {
    // c e g = 0, +4, +7 Halbtöne
    expect(startNotesInRange([60, 64, 67], { min: 60, max: 70 })).toEqual([60, 61, 62, 63])
    expect(startNotesInRange([67, 64, 60], { min: 60, max: 70 })).toEqual([67, 68, 69, 70])
  })

  it('liefert nichts, wenn die Übung nicht in die Range passt', () => {
    expect(startNotesInRange([60, 64, 67], { min: 60, max: 64 })).toEqual([])
  })

  it('validiert und speichert die Range', () => {
    expect(loadRange()).toEqual(DEFAULT_NOTE_RANGE)
    saveRange({ min: 50, max: 70 })
    expect(loadRange()).toEqual({ min: 50, max: 70 })

    window.localStorage.setItem('ear-training-intonation-range-v1', '{"min":70,"max":50}')
    expect(loadRange()).toEqual(DEFAULT_NOTE_RANGE)
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
