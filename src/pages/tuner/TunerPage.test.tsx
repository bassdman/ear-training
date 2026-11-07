import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  useLiveTuner: vi.fn(),
}))

vi.mock('../../features/tuner/hooks/useLiveTuner', () => ({
  useLiveTuner: mocks.useLiveTuner,
}))

import { TunerPage } from './TunerPage'

function renderPage() {
  return render(<MemoryRouter><TunerPage /></MemoryRouter>)
}

describe('TunerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useLiveTuner.mockReturnValue({
      status: 'idle',
      error: null,
      points: [],
      timeMs: 0,
      start: mocks.start,
      stop: mocks.stop,
    })
  })

  it('zeigt das Diagramm und startet das Mikrofon über die Toolbar', () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Tonhöhenanzeige' })).toBeInTheDocument()
    expect(screen.queryByText('-5 s')).not.toBeInTheDocument()
    expect(screen.queryByText('jetzt')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.tuner-grid-time line')).toHaveLength(6)
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('heading', { name: 'Stimm-Tuner' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mikrofon aus')
    fireEvent.click(screen.getByRole('button', { name: 'Mikrofon starten' }))
    expect(mocks.start).toHaveBeenCalledOnce()
  })

  it.each([
    ['listening', 'Mikrofon stoppen'],
    ['starting', 'Mikrofonstart abbrechen'],
  ])('stoppt oder bricht den Mikrofonstart im Zustand %s ab', (status, label) => {
    mocks.useLiveTuner.mockReturnValue({
      status, error: null, points: [], timeMs: 0, start: mocks.start, stop: mocks.stop,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('zeigt Mikrofonfehler weiterhin sichtbar und ermöglicht einen erneuten Start', () => {
    mocks.useLiveTuner.mockReturnValue({
      status: 'error', error: 'Mikrofonzugriff verweigert', points: [], timeMs: 0,
      start: mocks.start, stop: mocks.stop,
    })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Mikrofonzugriff verweigert')
    fireEvent.click(screen.getByRole('button', { name: 'Mikrofon starten' }))
    expect(mocks.start).toHaveBeenCalledOnce()
  })
})
