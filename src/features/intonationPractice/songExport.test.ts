import { describe, expect, it } from 'vitest'

import { serializeSong, songExportFilename } from './songExport'
import type { Song } from './types'

describe('song export', () => {
  const song: Song = {
    id: 'song-1',
    name: 'Test Lied',
    beatsPerMinute: 90,
    lines: [[
      { note: 60, text: 'Hallo', textParts: ['Hal', 'lo'] },
      { note: null, text: '', duration: 'eighth' },
    ]],
  }

  it('serialisiert alle Lieddaten als JSON', () => {
    expect(JSON.parse(serializeSong(song))).toEqual(song)
  })

  it('bildet einen gültigen Dateinamen aus dem Liednamen', () => {
    expect(songExportFilename(song)).toBe('test-lied.json')
  })
})