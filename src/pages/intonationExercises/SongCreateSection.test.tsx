import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INTONATION_SONGS_STORAGE_KEY } from '../../features/intonationPractice/storage'
import { DEFAULT_SONGS } from '../../features/intonationPractice/defaultSongs'
import { SongCreateSection } from './SongCreateSection'

describe('SongCreateSection', () => {
  beforeEach(() => window.localStorage.clear())

  it('legt Noten im 8-Achtel-Grid an, ändert die Tonhöhe und speichert Text pro Achtel', async () => {
    const user = userEvent.setup()
    render(<SongCreateSection />)

    await user.type(screen.getByLabelText('Name'), 'Rasterlied')
    await user.selectOptions(screen.getByLabelText('Notenwert'), 'whole')
    await user.click(screen.getByRole('button', { name: 'Eintrag auf Achtel 1 hinzufügen' }))
    await user.selectOptions(screen.getByLabelText('Tonhöhe'), '64')
    await user.type(screen.getByLabelText('Text auf Takt 1, Achtel 1'), 'Al')
    await user.type(screen.getByLabelText('Text auf Takt 1, Achtel 2'), 'le')
    await user.click(screen.getByRole('button', { name: 'Lied hinzufügen' }))

    const songs = JSON.parse(window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY) ?? '[]')
    expect(songs[0].lines).toEqual([
      [
        {
          note: 64,
          text: 'Al le',
          duration: 'whole',
          textParts: ['Al', 'le', '', '', '', '', '', ''],
        },
      ],
    ])
  })

  it('fügt eine Pause als eigenen Eintrag hinzu und speichert sie', async () => {
    const user = userEvent.setup()
    render(<SongCreateSection />)

    await user.type(screen.getByLabelText('Name'), 'Rasterlied')
    await user.click(screen.getByRole('button', { name: 'Eintrag auf Achtel 1 hinzufügen' }))
    await user.selectOptions(screen.getByLabelText('Eintrag'), 'rest')
    await user.click(screen.getByRole('button', { name: 'Eintrag auf Achtel 3 hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Lied hinzufügen' }))

    const songs = JSON.parse(window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY) ?? '[]')
    expect(songs[0].lines[0][1]).toEqual({
      note: null,
      text: '',
      duration: 'quarter',
    })
  })

  it('fügt über die Werkzeugleiste eine Pause nach der ausgewählten Note ein', async () => {
    const user = userEvent.setup()
    render(<SongCreateSection />)

    await user.type(screen.getByLabelText('Name'), 'Rasterlied')
    await user.click(screen.getByRole('button', { name: 'Eintrag auf Achtel 1 hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Pause hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Lied hinzufügen' }))

    const songs = JSON.parse(window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY) ?? '[]')
    expect(songs[0].lines[0]).toEqual([
      { note: 60, text: '', duration: 'quarter', textParts: ['', ''] },
      { note: null, text: '', duration: 'quarter' },
    ])
  })

  it('bearbeitet ein JSON-Lied und setzt es auf den JSON-Ausgangszustand zurück', async () => {
    const user = userEvent.setup()
    const defaultSong = DEFAULT_SONGS.find((song) => song.id === 'default-alle-meine-entchen')!
    render(<SongCreateSection />)

    await user.click(screen.getByRole('button', { name: 'Lied "Alle meine Entchen" bearbeiten' }))
    expect(screen.getByLabelText('Name')).toHaveValue(defaultSong.name)
    expect(screen.getByLabelText('Text auf Takt 1, Achtel 12')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Entchen geändert')
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }))

    let savedSongs = JSON.parse(window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY) ?? '[]')
    expect(savedSongs).toHaveLength(1)
    expect(savedSongs[0].id).toBe(defaultSong.id)
    expect(savedSongs[0].name).toBe('Entchen geändert')
    expect(screen.getByText('Entchen geändert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lied "Entchen geändert" zurücksetzen' }))
    savedSongs = JSON.parse(window.localStorage.getItem(INTONATION_SONGS_STORAGE_KEY) ?? '[]')
    expect(savedSongs).toEqual([])
    expect(screen.getByText(defaultSong.name)).toBeInTheDocument()
  })

  it('öffnet Every Breath You Take mit den vorhandenen tiefen Tonhöhen', async () => {
    const user = userEvent.setup()
    const song = DEFAULT_SONGS.find((entry) => entry.id === 'default-every-breath-you-take')!
    const infoLog = vi.spyOn(console, 'info').mockImplementation(() => {})
    render(<SongCreateSection />)

    await user.click(screen.getByRole('button', { name: `Lied "${song.name}" bearbeiten` }))
    await user.click(screen.getAllByRole('button', { name: 'h2', exact: true })[0])

    expect(screen.getByLabelText('Tonhöhe')).toHaveValue('47')
    expect(infoLog).toHaveBeenCalledWith(
      '[SongEditor] Lied geöffnet',
      expect.objectContaining({ id: song.id }),
    )
    infoLog.mockRestore()
  })

  it('zeigt beim Öffnen eines ungültigen Lieds Zeile, Eintrag und Ursache an', async () => {
    const user = userEvent.setup()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.localStorage.setItem(
      INTONATION_SONGS_STORAGE_KEY,
      JSON.stringify([
        { id: 'broken', name: 'Kaputtes Lied', lines: [[{ note: 128, text: 'x' }]] },
      ]),
    )
    render(<SongCreateSection />)

    await user.click(screen.getByRole('button', { name: 'Lied "Kaputtes Lied" bearbeiten' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Zeile 1, Eintrag 1: 128 ist keine gültige MIDI-Tonhöhe (ganze Zahl von 0 bis 127).',
    )
    expect(errorLog).toHaveBeenCalledWith(
      '[SongEditor] Lied konnte nicht geöffnet werden',
      expect.objectContaining({ id: 'broken' }),
    )
    errorLog.mockRestore()
  })

  it('exportiert ein Lied aus dem Liedmenü als JSON-Datei', async () => {
    const user = userEvent.setup()
    const song = DEFAULT_SONGS.find((entry) => entry.id === 'default-every-breath-you-take')!
    const createObjectURL = vi.fn(() => 'blob:song-export')
    const revokeObjectURL = vi.fn()
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    render(<SongCreateSection />)

    await user.click(screen.getByRole('button', { name: `Lied "${song.name}" exportieren` }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const exportedBlob = createObjectURL.mock.calls[0][0] as Blob
    expect(exportedBlob.type).toBe('application/json;charset=utf-8')
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(anchorClick.mock.instances[0]).toMatchObject({
      download: 'every-breath-you-take-the-police.json',
      href: 'blob:song-export',
    })

    vi.unstubAllGlobals()
    anchorClick.mockRestore()
  })
})
