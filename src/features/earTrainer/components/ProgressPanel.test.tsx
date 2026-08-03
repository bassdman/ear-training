import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProgressPanel } from './ProgressPanel'

describe('ProgressPanel', () => {
  it('rendert Meta-Infos, Fortschritt und Tonstile', () => {
    const { container } = render(
      <ProgressPanel
        levelIdx={1}
        sectionIdx={2}
        toneSet={['C', 'E', 'G']}
        unlockedToneStyles={['colorA', 'colorB']}
        levelProgress={7}
        levelProgressTotal={25}
        levelCount={12}
        sectionSteps={[5, 5, 5, 10]}
        leveledUpToast="Abschnitt 4 freigeschaltet"
      />,
    )

    expect(screen.getByText('Übung 2 / 12')).toBeInTheDocument()
    expect(screen.getByText('Abschnitt 3 / 4')).toBeInTheDocument()
    expect(screen.getByText('Töne: C · E · G')).toBeInTheDocument()
    expect(screen.getByText(/Tonstile im Spiel: Klangfarbe A · Klangfarbe B/)).toBeInTheDocument()
    expect(screen.getByText('Abschnitt 4 freigeschaltet')).toBeInTheDocument()

    expect(container.querySelectorAll('.ear-scale-cell').length).toBe(25)
    expect(container.querySelectorAll('.ear-scale-cell.is-filled').length).toBe(7)
    expect(container.querySelectorAll('.ear-scale-break').length).toBe(3)
  })
})
