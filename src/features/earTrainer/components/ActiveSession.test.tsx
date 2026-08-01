import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActiveSession } from './ActiveSession'

describe('ActiveSession', () => {
  it('rendert zwei klickbare Ton-Buttons', () => {
    const onPlayTone = vi.fn()
    render(
      <ActiveSession
        buttons={[
          { id: 'piano-c4', label: 'Klavier C4', isPlaying: false, isReady: true },
          { id: 'flute-g4', label: 'Flöte G4', isPlaying: false, isReady: true },
        ]}
        onPlayTone={onPlayTone}
        toneSplashColor={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Klavier C4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Flöte G4' }))
    expect(onPlayTone).toHaveBeenCalledTimes(2)
    expect(onPlayTone).toHaveBeenNthCalledWith(1, 'piano-c4')
    expect(onPlayTone).toHaveBeenNthCalledWith(2, 'flute-g4')
  })

  it('zeigt den Spielzustand im Button-Text', () => {
    render(
      <ActiveSession
        buttons={[
          { id: 'piano-c4', label: 'Klavier C4', isPlaying: true, isReady: true },
          { id: 'flute-g4', label: 'Flöte G4', isPlaying: false, isReady: true },
        ]}
        onPlayTone={vi.fn()}
        toneSplashColor={null}
      />,
    )

    expect(screen.getByRole('button', { name: 'Spielt...' })).toBeInTheDocument()
  })

  it('zeigt den Farbklecks, wenn eine Tonfarbe gesetzt ist', () => {
    render(
      <ActiveSession
        buttons={[
          { id: 'trial', label: 'Weiter', isPlaying: false, isReady: true },
        ]}
        onPlayTone={vi.fn()}
        toneSplashColor="hsl(120 82% 22%)"
      />,
    )

    expect(screen.getByLabelText('Tonfarbe')).toBeInTheDocument()
  })
})
