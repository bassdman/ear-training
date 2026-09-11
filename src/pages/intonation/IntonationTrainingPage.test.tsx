import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { getMicrophoneErrorMessage, getPitchResult, IntonationTrainingPage } from './IntonationTrainingPage'

describe('getPitchResult', () => {
  it('bestätigt den Zielton innerhalb der Cent-Toleranz', () => {
    expect(getPitchResult(440, 'a4')).toMatchObject({
      detectedNote: 'A4',
      cents: 0,
      isInTune: true,
    })
  })

  it('meldet einen Ton außerhalb der Toleranz mit seiner Abweichung', () => {
    expect(getPitchResult(466.16, 'a4')).toMatchObject({
      detectedNote: 'Ais4',
      cents: 0,
      isInTune: false,
    })
  })
})

describe('IntonationTrainingPage', () => {
  it('zeigt die Mikrofonprüfung erst nach dem Einschalten', () => {
    render(
      <MemoryRouter>
        <IntonationTrainingPage />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('checkbox', { name: 'Mikrofonprüfung' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Mikrofon starten für A4' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Mikrofon starten für A4' })).toBeInTheDocument()
  })
})

describe('getMicrophoneErrorMessage', () => {
  it('ordnet verweigerten Mikrofonzugriff korrekt zu', () => {
    const error = new DOMException('', 'NotAllowedError')

    expect(getMicrophoneErrorMessage(error)).toContain('blockiert')
  })
})