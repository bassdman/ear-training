import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IntonationSongsPage } from './IntonationSongsPage'

vi.mock('../../features/intonationPractice/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/intonationPractice/storage')>()
  return {
    ...actual,
    loadAllSongs: () => [{ id: 'test-song', name: 'Testlied', lines: [[{ note: 60, text: 'Ton' }]] }],
    loadSongTranspositions: () => ({}),
    saveSongTranspositions: vi.fn(),
  }
})

vi.mock('./useSingStep', () => ({
  SING_HOLD_MS: 2500,
  useSingStep: () => ({
    error: null,
    stopOwned: vi.fn(),
    listeningKey: null,
    progress: null,
    stop: vi.fn(),
    start: vi.fn(),
  }),
}))

describe('IntonationSongsPage', () => {
  beforeEach(() => window.localStorage.clear())

  it('hält die Einstellungen beim Transponieren offen und schließt sie bei Außenklick', () => {
    render(<IntonationSongsPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Lied-Einstellungen' })[0])
    const transposeControls = screen.getByRole('group', { name: 'Lied transponieren' })
    const transposeButtons = transposeControls.querySelectorAll('.ie-transpose-controls button')

    expect(Array.from(transposeButtons, (button) => button.getAttribute('aria-label'))).toEqual([
      'Einen Halbton tiefer',
      'Einen Halbton höher',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Einen Halbton höher' }))

    expect(screen.getByRole('group', { name: 'Lied transponieren' })).toBeVisible()
    expect(screen.getByText('+1 Halbtöne')).toBeVisible()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('group', { name: 'Lied transponieren' })).not.toBeInTheDocument()
  })
})