import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import recordButton from '../../assets/record_button.svg'
import recordButtonActive from '../../assets/record_button-active.svg'
import recordButtonDisabled from '../../assets/record_button-active-disabled.svg'
import { AufnahmeButton } from './AufnahmeButton'

describe('AufnahmeButton', () => {
  it('zeigt den normalen, aktiven und deaktivierten SVG-Zustand', () => {
    const onClick = vi.fn()
    const { rerender } = render(<AufnahmeButton disabled={false} onClick={onClick} />)

    expect(screen.getByRole('button', { name: 'Aufnehmen' }).querySelector('img')).toHaveAttribute('src', recordButton)
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Aufnehmen' }))
    expect(screen.getByRole('button', { name: 'Aufnehmen' }).querySelector('img')).toHaveAttribute('src', recordButtonActive)

    rerender(<AufnahmeButton disabled={false} recording onClick={onClick} />)
    expect(screen.getByRole('button', { name: 'Aufnahme stoppen' }).querySelector('img')).toHaveAttribute('src', recordButtonActive)

    rerender(<AufnahmeButton disabled recording onClick={onClick} />)
    expect(screen.getByRole('button', { name: 'Aufnahme stoppen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aufnahme stoppen' }).querySelector('img')).toHaveAttribute('src', recordButtonDisabled)
  })

  it('löst den übergebenen Aufnahme-Handler aus', () => {
    const onClick = vi.fn()
    render(<AufnahmeButton disabled={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aufnehmen' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
