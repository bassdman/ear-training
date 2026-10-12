import { parseNote } from './notes'
import { generateSections } from './sections'
import type { Section, Song, SongNote, SongNoteValue } from './types'

export type ParsedSong = { lines: SongNote[][] } | { error: string }

export const DEFAULT_BEATS_PER_MINUTE = 100
export const BEATS_PER_MINUTE_RANGE = { min: 20, max: 300 }
export const SONG_TRANSPOSE_RANGE = { min: -12, max: 12 }
const NOTE_VALUE_BY_DENOMINATOR: Record<number, SongNoteValue> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
}
const NOTE_VALUE_DENOMINATOR: Record<SongNoteValue, number> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
}
const NOTE_VALUE_BEATS: Record<SongNoteValue, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
}

export function isValidSongNoteValue(value: unknown): value is SongNoteValue {
  return value === 'whole' || value === 'half' || value === 'quarter' || value === 'eighth'
}

export function songNoteDurationSeconds(
  note: Pick<SongNote, 'duration'>,
  quarterNoteDurationS: number,
): number {
  return quarterNoteDurationS * NOTE_VALUE_BEATS[note.duration ?? 'quarter']
}

function noteValueSuffix(duration?: SongNoteValue): string {
  return duration && duration !== 'quarter' ? `/${NOTE_VALUE_DENOMINATOR[duration]}` : ''
}

export function formatSongNoteValue(duration?: SongNoteValue): string {
  return noteValueSuffix(duration)
}

export function isValidSongTranspose(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SONG_TRANSPOSE_RANGE.min &&
    value <= SONG_TRANSPOSE_RANGE.max
  )
}

export function isValidBeatsPerMinute(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= BEATS_PER_MINUTE_RANGE.min &&
    value <= BEATS_PER_MINUTE_RANGE.max
  )
}

// Dauer einer Viertelnote in Sekunden; Songnoten und Pausen skalieren diese Dauer.
export function noteDurationSeconds(song: Pick<Song, 'beatsPerMinute'>): number {
  return 60 / (song.beatsPerMinute ?? DEFAULT_BEATS_PER_MINUTE)
}

// Eine Zeile pro Liedzeile; Notenwert optional als Nenner vor dem Text, z. B. "c4/8:Al".
export function parseSongInput(input: string): ParsedSong {
  const lines: SongNote[][] = []

  for (const [index, rawLine] of input.split('\n').entries()) {
    const tokens = rawLine.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue

    const line: SongNote[] = []
    for (const token of tokens) {
      const [pitchedPart, ...textParts] = token.split(':')
      const match = pitchedPart.match(/^(.*?)(?:\/([1248]))?$/)
      if (!match) return { error: `Zeile ${index + 1}: Ungültiger Notenwert in "${token}"` }
      const [, notePart, denominatorText] = match
      const duration = denominatorText ? NOTE_VALUE_BY_DENOMINATOR[Number(denominatorText)] : undefined
      if (denominatorText && !duration) {
        return { error: `Zeile ${index + 1}: Notenwert muss 1, 2, 4 oder 8 sein.` }
      }
      const note = notePart === '-' ? null : parseNote(notePart)
      if (notePart !== '-' && note === null) {
        return { error: `Zeile ${index + 1}: Unbekannter Ton "${notePart}"` }
      }
      line.push({
        note,
        text: textParts.join(':'),
        ...(duration && duration !== 'quarter' ? { duration } : {}),
      })
    }
    lines.push(line)
  }

  if (!lines.some((line) => line.some((entry) => entry.note !== null))) {
    return { error: 'Bitte mindestens einen Ton eingeben.' }
  }
  return { lines }
}

export function formatSongLine(line: readonly SongNote[], formatNote: (midi: number) => string): string {
  return line
    .map((entry) =>
      [
        `${entry.note === null ? '-' : formatNote(entry.note)}${noteValueSuffix(entry.duration)}`,
        entry.text,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' · ')
}

// Auswahl als Positionen (inklusive) über alle Töne und Pausen des Liedes, Zeile für Zeile gezählt.
export type SongRange = { start: number; end: number }

export type SongEntry = SongNote & { index: number; line: number }

export function flattenSong(song: Song): SongEntry[] {
  let index = 0
  return song.lines.flatMap((line, lineIndex) =>
    line.map((entry) => ({ ...entry, index: index++, line: lineIndex })),
  )
}

export function sliceSong(song: Song, range: SongRange): Song {
  let index = 0
  const lines = song.lines
    .map((line) =>
      line.filter(() => {
        const current = index++
        return current >= range.start && current <= range.end
      }),
    )
    .filter((line) => line.length > 0)
  return { ...song, lines }
}

export function transposeSong(song: Song, semitones: number): Song {
  if (semitones === 0) return song
  return {
    ...song,
    lines: song.lines.map((line) =>
      line.map((entry) => ({
        ...entry,
        note: entry.note === null ? null : entry.note + semitones,
      })),
    ),
  }
}

// Aufwärmübungen mit allen Tönen des Liedes, danach der Liedtext Zeile für Zeile (ohne Transposition).
// Mit withSelection kommt eine Auswahl über mehrere Zeilen zusätzlich als eine zusammenhängende Unterübung.
export function generateSongSections(
  song: Song,
  options: { withSelection?: boolean } = {},
): Section[] {
  const notes: number[] = []
  const runs: number[][] = []
  for (const line of song.lines) {
    let run: number[] = []
    for (const entry of line) {
      if (entry.note === null) {
        if (run.length > 0) runs.push(run)
        run = []
        continue
      }
      notes.push(entry.note)
      run.push(entry.note)
    }
    if (run.length > 0) runs.push(run)
  }

  const warmUps = generateSections(notes, { pairSequences: runs }).filter(
    (section) => section.kind === 'single' || section.kind === 'pairs',
  )
  const lyricSteps = song.lines.map((line) => ({
    notes: line.map((entry) => entry.note),
    syllables: line.map((entry) => entry.textParts?.filter(Boolean).join(' ') || entry.text),
    noteValues: line.map((entry) => entry.duration ?? 'quarter'),
    durationsS: line.map((entry) =>
      songNoteDurationSeconds(entry, noteDurationSeconds(song)),
    ),
  }))
  const sections: Section[] = [...warmUps, { kind: 'lyrics', title: 'Liedtext', steps: lyricSteps }]

  if (options.withSelection && lyricSteps.length > 1) {
    sections.push({
      kind: 'selection',
      title: 'Auswahl',
      steps: [
        {
          notes: lyricSteps.flatMap((step) => step.notes),
          syllables: lyricSteps.flatMap((step) => step.syllables),
          noteValues: lyricSteps.flatMap((step) => step.noteValues ?? []),
          durationsS: lyricSteps.flatMap((step) => step.durationsS ?? []),
        },
      ],
    })
  }
  return sections
}
