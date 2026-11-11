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
import { DEFAULT_TUNER_SETTINGS, TUNER_SETTINGS_STORAGE_KEY } from '../../features/tuner/settings'

function renderPage() {
  return render(<MemoryRouter><TunerPage /></MemoryRouter>)
}

describe('TunerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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

  it('speichert Änderungen, lädt sie erneut und stellt Standardwerte wieder her', () => {
    const { unmount } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }))
    const volume = screen.getByLabelText('Mindestlautstärke (RMS)')
    fireEvent.change(volume, { target: { value: '0.004' } })
    expect(JSON.parse(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY) ?? '')).toEqual({
      ...DEFAULT_TUNER_SETTINGS, minVolumeRms: 0.004,
    })
    expect(mocks.useLiveTuner).toHaveBeenLastCalledWith({
      ...DEFAULT_TUNER_SETTINGS, minVolumeRms: 0.004,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen schließen' }))
    expect(screen.getByRole('button', { name: 'Einstellungen öffnen' })).toHaveFocus()
    unmount()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }))
    expect(screen.getByLabelText('Mindestlautstärke (RMS)')).toHaveValue(0.004)
    fireEvent.click(screen.getByRole('button', { name: 'Standardwerte wiederherstellen' }))
    expect(JSON.parse(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY) ?? '')).toEqual(DEFAULT_TUNER_SETTINGS)
  })

  it('speichert ungültige Werte nicht und schließt das Menü mit Escape', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }))
    fireEvent.change(screen.getByLabelText('Mindestklarheit'), { target: { value: '2' } })
    expect(screen.getByRole('alert')).toHaveTextContent('zwischen 0 und 1')
    expect(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY)).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Einstellungen öffnen' })).toHaveFocus()
  })

  it('speichert die Anzahl übersprungener Oktav-Frames und lehnt ungültige Werte ab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }))
    const input = screen.getByLabelText('Große Tonsprünge: Frames überspringen')
    fireEvent.change(input, { target: { value: '0' } })
    expect(mocks.useLiveTuner).toHaveBeenLastCalledWith({ ...DEFAULT_TUNER_SETTINGS, octaveSkipFrames: 0 })
    fireEvent.change(input, { target: { value: '101' } })
    expect(screen.getByRole('alert')).toHaveTextContent('zwischen 0 und 100')
    expect(JSON.parse(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY) ?? '').octaveSkipFrames).toBe(0)
  })

  it('meldet Speicherfehler im geöffneten Menü', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }))
    fireEvent.change(screen.getByLabelText('Mindestklarheit'), { target: { value: '0.8' } })
    expect(screen.getByRole('alert')).toHaveTextContent('konnten nicht gespeichert werden')
    expect(mocks.useLiveTuner).toHaveBeenLastCalledWith({ ...DEFAULT_TUNER_SETTINGS, minPitchClarity: 0.8 })
    save.mockRestore()
    log.mockRestore()
  })
})
