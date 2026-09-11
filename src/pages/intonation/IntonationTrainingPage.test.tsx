import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  getMicrophoneErrorMessage,
  getPitchResult,
  IntonationTrainingPage,
  readIntonationSettings,
} from './IntonationTrainingPage'

describe('getPitchResult', () => {
  it('bestätigt den Zielton innerhalb der Cent-Toleranz', () => {
    expect(getPitchResult(440, 'a4')).toMatchObject({
      detectedNote: 'A4',
      cents: 0,
      isInTune: true,
    })
  })

  it('akzeptiert D3 auch bei einer kleinen, mobilen Messabweichung', () => {
    const d3Frequency = 440 * 2 ** ((50 - 69) / 12)
    const frequency35CentsTooHigh = d3Frequency * 2 ** (35 / 1200)

    expect(getPitchResult(frequency35CentsTooHigh, 'd3')).toMatchObject({
      detectedNote: 'D3',
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
  it('bietet standardmäßig kein Referenzinstrument und keine Mikrofonprüfung an', () => {
    render(
      <MemoryRouter>
        <IntonationTrainingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('combobox', { name: 'Referenzinstrument' })).toHaveValue('none')
    expect(screen.getByRole('option', { name: 'Zufällig' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chillen' })).toBeInTheDocument()

    const toggle = screen.getByRole('checkbox', { name: 'Mikrofonprüfung' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Mikrofon starten für A4' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Mikrofon starten für A4' })).toBeInTheDocument()
  }, 15000)
})

describe('readIntonationSettings', () => {
  it('stellt gespeicherte Instrument- und Mikrofoneinstellungen wieder her', () => {
    window.localStorage.setItem('ear-training-intonation-settings-v1', JSON.stringify({
      microphoneEnabled: true,
      selectedInstrumentId: 'flute',
    }))

    expect(readIntonationSettings()).toEqual({
      microphoneEnabled: true,
      selectedInstrumentId: 'flute',
    })

    window.localStorage.clear()
  })
})

describe('getMicrophoneErrorMessage', () => {
  it('ordnet verweigerten Mikrofonzugriff korrekt zu', () => {
    const error = new DOMException('', 'NotAllowedError')

    expect(getMicrophoneErrorMessage(error)).toContain('blockiert')
  })
})