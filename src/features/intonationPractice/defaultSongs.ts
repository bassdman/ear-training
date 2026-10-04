import { BEATS_PER_MINUTE_RANGE, isValidBeatsPerMinute, parseSongInput } from './songs'
import type { Song } from './types'

type SongConfig = { id: string; name: string; beatsPerMinute?: number; lines: string[] }

// Jede Datei in config/songs/ ist ein Lied; Zeilen im selben Format wie die Eingabemaske.
const songConfigs = import.meta.glob<SongConfig>('./config/songs/*.json', {
  eager: true,
  import: 'default',
})

export const DEFAULT_SONGS: Song[] = Object.entries(songConfigs)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([path, { id, name, beatsPerMinute, lines }]) => {
    const parsed = parseSongInput(lines.join('\n'))
    if ('error' in parsed) throw new Error(`Standardlied "${path}": ${parsed.error}`)
    if (beatsPerMinute !== undefined && !isValidBeatsPerMinute(beatsPerMinute)) {
      throw new Error(`Standardlied "${path}": beatsPerMinute muss zwischen ${BEATS_PER_MINUTE_RANGE.min} und ${BEATS_PER_MINUTE_RANGE.max} liegen`)
    }
    return { id, name, beatsPerMinute, lines: parsed.lines }
  })
