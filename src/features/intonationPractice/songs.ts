import { parseNote } from './notes'
import { generateSections } from './sections'
import type { Section, Song, SongNote } from './types'

export type ParsedSong = { lines: SongNote[][] } | { error: string }

export const DEFAULT_BEATS_PER_MINUTE = 100
export const BEATS_PER_MINUTE_RANGE = { min: 20, max: 300 }

export function isValidBeatsPerMinute(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= BEATS_PER_MINUTE_RANGE.min &&
    value <= BEATS_PER_MINUTE_RANGE.max
  )
}

// Dauer eines Tones (und einer Pause) in Sekunden
export function noteDurationSeconds(song: Pick<Song, 'beatsPerMinute'>): number {
  return 60 / (song.beatsPerMinute ?? DEFAULT_BEATS_PER_MINUTE)
}

// Eine Zeile pro Liedzeile; Tokens: "ton:text", "ton" (ohne Text) oder "-" (Pause).
export function parseSongInput(input: string): ParsedSong {
  const lines: SongNote[][] = []

  for (const [index, rawLine] of input.split('\n').entries()) {
    const tokens = rawLine.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue

    const line: SongNote[] = []
    for (const token of tokens) {
      if (token === '-') {
        line.push({ note: null, text: '' })
        continue
      }
      const [notePart, ...textParts] = token.split(':')
      const note = parseNote(notePart)
      if (note === null) return { error: `Zeile ${index + 1}: Unbekannter Ton "${notePart}"` }
      line.push({ note, text: textParts.join(':') })
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
    .map((entry) => (entry.note === null ? '-' : [formatNote(entry.note), entry.text].filter(Boolean).join(' ')))
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
    syllables: line.map((entry) => entry.text),
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
        },
      ],
    })
  }
  return sections
}
