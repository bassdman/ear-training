import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SessionSummary } from './SessionSummary'

describe('SessionSummary', () => {
  it('zeigt Session-Ergebnis und ruft New-Session-Callback auf', () => {
    const onNewSession = vi.fn()

    render(
      <SessionSummary
        sessionCorrect={7}
        sessionGuesses={10}
        accuracy={70}
        levelIdx={2}
        sectionIdx={1}
        bestStreak={9}
        onNewSession={onNewSession}
      />,
    )

    expect(screen.getByText('Session beendet')).toBeInTheDocument()
    expect(screen.getByText(/7 von 10 richtig/)).toBeInTheDocument()
    expect(screen.getByText(/Beste Serie insgesamt: 9/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Neue Session starten' }))
    expect(onNewSession).toHaveBeenCalledTimes(1)
  })
})
