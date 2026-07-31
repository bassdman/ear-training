import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrainerHeader } from './TrainerHeader'

describe('TrainerHeader', () => {
  it('zeigt Titel und Bereichsinformationen', () => {
    render(<TrainerHeader rangeLabel="Mittlere Lage" rangeSubtitle="C4 bis H4" />)

    expect(screen.getByText('Gehörtraining')).toBeInTheDocument()
    expect(screen.getByText('Mittlere Lage · C4 bis H4')).toBeInTheDocument()
  })
})
