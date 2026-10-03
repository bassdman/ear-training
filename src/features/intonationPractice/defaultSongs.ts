import { parseSongInput } from './songs'
import type { Song } from './types'

type SongConfig = { id: string; name: string; lines: string[] }

// Jede Datei in config/songs/ ist ein Lied; Zeilen im selben Format wie die Eingabemaske.
const songConfigs = import.meta.glob<SongConfig>('./config/songs/*.json', {
  eager: true,
  import: 'default',
})

export const DEFAULT_SONGS: Song[] = Object.entries(songConfigs)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([path, { id, name, lines }]) => {
    const parsed = parseSongInput(lines.join('\n'))
    if ('error' in parsed) throw new Error(`Standardlied "${path}": ${parsed.error}`)
    return { id, name, lines: parsed.lines }
  })
