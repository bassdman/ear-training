import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  getMicrophoneErrorMessage,
  getPitchResult,
  IntonationTrainingPage,
  readIntonationSettings,
} from './IntonationTrainingPage'
import { NoteGroup } from './components/NoteGroup'

beforeEach(() => {
  window.localStorage.clear()
})

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

  it('trennt das Abspielen des Tons und das Starten des Mikrofons', () => {
    render(
      <MemoryRouter>
        <IntonationTrainingPage />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('checkbox', { name: 'Mikrofonprüfung' })
    fireEvent.click(toggle)

    const noteButtons = screen.getAllByRole('button', { name: 'A4' })

    fireEvent.click(noteButtons[0])
    expect(screen.queryByText('---')).not.toBeInTheDocument()
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

describe('NoteGroup', () => {
  it('zeigt Mini-Tuner und Zwischenfeedback während der Aufnahme an', () => {
    const { rerender, container } = render(
      <NoteGroup
        noteId="a4"
        isActive={false}
        isListening={true}
        listeningPitchState={{
          note: '---',
          cents: null,
          isInTune: false,
          holdProgress: 0,
        }}
        microphoneEnabled={true}
        pitchResult={null}
        onPlayNote={() => {}}
        onStartListening={() => {}}
        onStopListening={() => {}}
      />,
    )

    expect(screen.getByText('---')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mikrofon stoppen für A4' })).toBeInTheDocument()

    rerender(
      <NoteGroup
        noteId="a4"
        isActive={false}
        isListening={true}
        listeningPitchState={{
          note: 'A4',
          cents: 5,
          isInTune: true,
          holdProgress: 0.6,
        }}
        microphoneEnabled={true}
        pitchResult={null}
        onPlayNote={() => {}}
        onStartListening={() => {}}
        onStopListening={() => {}}
      />,
    )

    expect(container.querySelector('.intonation-tuner-note')).toHaveTextContent('A4')
    expect(screen.getByText('+5 ct')).toBeInTheDocument()
    expect(container.querySelector('.intonation-hold-ring-progress.is-active')).toBeInTheDocument()
    expect(container.querySelector('.intonation-tuner-needle.is-in-tune')).toBeInTheDocument()
  })

  it('zeigt "Kein Ton erkannt.", wenn die Aufnahme ohne erkannten Ton endet', () => {
    render(
      <NoteGroup
        noteId="a4"
        isActive={false}
        isListening={false}
        microphoneEnabled={true}
        pitchResult={{
          detectedNote: '---',
          cents: 0,
          isInTune: false,
        }}
        onPlayNote={() => {}}
        onStartListening={() => {}}
        onStopListening={() => {}}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Kein Ton erkannt.')
  })

  it('zeigt das Pitch-Ergebnis nur bei aktivierter Mikrofonprüfung an', () => {
    const pitchResult = {
      detectedNote: 'A4',
      cents: 3,
      isInTune: true,
    }

    const { rerender } = render(
      <NoteGroup
        noteId="a4"
        isActive={false}
        isListening={false}
        microphoneEnabled={true}
        pitchResult={pitchResult}
        onPlayNote={() => {}}
        onStartListening={() => {}}
        onStopListening={() => {}}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Richtig (+3 Cent)')

    rerender(
      <NoteGroup
        noteId="a4"
        isActive={false}
        isListening={false}
        microphoneEnabled={false}
        pitchResult={pitchResult}
        onPlayNote={() => {}}
        onStartListening={() => {}}
        onStopListening={() => {}}
      />,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})