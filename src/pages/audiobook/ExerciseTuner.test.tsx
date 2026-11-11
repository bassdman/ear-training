import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PitchPoint } from '../../features/tuner/pitch'
import { DEFAULT_TUNER_SETTINGS, TUNER_SETTINGS_STORAGE_KEY } from '../../features/tuner/settings'
import type { AudioTrack } from './audioStorage'
import { ExerciseTuner } from './ExerciseTuner'
import type { ReferencePitchJob } from './referencePitch'

const mock = vi.hoisted(() => ({
  state: { status: 'idle', error: null as string | null, points: [] as { timeMs: number, frequency: number | null }[], timeMs: 0 },
  start: vi.fn(),
  stop: vi.fn(),
}))
vi.mock('../../features/tuner/hooks/useLiveTuner', () => ({
  useLiveTuner: () => ({ ...mock.state, start: mock.start, stop: mock.stop }),
}))

class TestWorker {
  static instance: TestWorker
  jobs: ReferencePitchJob[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn()
  constructor() { TestWorker.instance = this }
  postMessage(job: ReferencePitchJob) { this.jobs.push(job) }
  complete(id: string, points: PitchPoint[]) { this.onmessage?.({ data: { id, points } } as MessageEvent) }
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  mock.state = { status: 'idle', error: null, points: [], timeMs: 0 }
  mock.start.mockReset()
  mock.stop.mockReset()
})

describe('Übungsstimmgerät', () => {
  it('verschiebt die Wiedergabeposition per Drag mit korrekter Zeit- und Begrenzungsskala', () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.isPrimary = init.isPrimary ?? false
      }
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    const onSeek = vi.fn()
    render(<ExerciseTuner tracks={[]} decoded={{}} position={5} duration={10} playing seekVersion={0} controlsTarget={null} onSeek={onSeek} />)
    const chart = screen.getByRole('slider', { name: 'Wiedergabeposition im Stimmgerät' })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect)
    chart.setPointerCapture = vi.fn()
    chart.hasPointerCapture = vi.fn(() => true)
    chart.releasePointerCapture = vi.fn()
    fireEvent.pointerDown(chart, { pointerId: 1, isPrimary: true, button: 0, clientX: 200 })
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 10 })
    expect(onSeek).toHaveBeenLastCalledWith(7.5)
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 1000 })
    expect(onSeek).toHaveBeenLastCalledWith(0)
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: -1000 })
    expect(onSeek).toHaveBeenLastCalledWith(10)
    fireEvent.pointerUp(chart, { pointerId: 1 })
    expect(chart.releasePointerCapture).toHaveBeenCalledWith(1)
    onSeek.mockClear()
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 100 })
    expect(onSeek).not.toHaveBeenCalled()
    fireEvent.pointerDown(chart, { pointerId: 2, isPrimary: true, button: 0, clientX: 200 })
    fireEvent.pointerCancel(chart, { pointerId: 2 })
    fireEvent.pointerMove(chart, { pointerId: 2, clientX: 100 })
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('ermöglicht Springen per Tastatur und berücksichtigt Songgrenzen', () => {
    const onSeek = vi.fn()
    const props = { tracks: [], decoded: {}, position: 5, duration: 10, playing: false, seekVersion: 0, controlsTarget: null, onSeek }
    const { rerender } = render(<ExerciseTuner {...props} />)
    const chart = screen.getByRole('slider', { name: 'Wiedergabeposition im Stimmgerät' })
    expect(chart).toHaveAttribute('aria-valuenow', '5')
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    expect(onSeek).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(onSeek).toHaveBeenLastCalledWith(6)
    fireEvent.keyDown(chart, { key: 'Home' })
    expect(onSeek).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(chart, { key: 'End' })
    expect(onSeek).toHaveBeenLastCalledWith(10)
    onSeek.mockClear()
    rerender(<ExerciseTuner {...props} position={10} />)
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('speichert die Filtereinstellung und analysiert die Referenz mit dem neuen Wert erneut', () => {
    vi.stubGlobal('Worker', TestWorker)
    const audio = new Blob(['a'])
    const tracks: AudioTrack[] = [{ id: 'v', projectId: 'p', type: 'vocal', name: 'Lead', createdAt: 1, clips: [{ id: 'a', name: 'a', audio, start: 0, duration: 1 }] }]
    const buffer: AudioBuffer = { sampleRate: 2, duration: 1, length: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(2), copyFromChannel: vi.fn(), copyToChannel: vi.fn() }
    const props = { tracks, decoded: { a: { buffer } }, position: 0, duration: 1, playing: false, seekVersion: 0, controlsTarget: document.body, onSeek: vi.fn() }
    const { unmount } = render(<ExerciseTuner {...props} />)
    const oldWorker = TestWorker.instance
    expect(oldWorker.jobs[0].octaveSkipFrames).toBe(2)
    act(() => oldWorker.complete('a', [{ timeMs: 0, frequency: 220 }]))
    fireEvent.click(screen.getByRole('button', { name: 'Stimmgerät-Einstellungen' }))
    fireEvent.change(screen.getByLabelText('Oktavsprung: Frames überspringen'), { target: { value: '4' } })
    expect(JSON.parse(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY) ?? '')).toEqual({ ...DEFAULT_TUNER_SETTINGS, octaveSkipFrames: 4 })
    const newWorker = TestWorker.instance
    expect(oldWorker.terminate).toHaveBeenCalledOnce()
    expect(newWorker.jobs[0].octaveSkipFrames).toBe(4)
    expect(screen.getByRole('status')).toHaveTextContent('analysiert')
    act(() => oldWorker.complete('a', [{ timeMs: 0, frequency: 440 }]))
    expect(screen.getByRole('status')).toHaveTextContent('analysiert')
    act(() => newWorker.complete('a', [{ timeMs: 0, frequency: 220 }]))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen schließen' }))
    expect(screen.getByRole('button', { name: 'Stimmgerät-Einstellungen' })).toHaveFocus()
    unmount()
    render(<ExerciseTuner {...props} />)
    expect(TestWorker.instance.jobs[0].octaveSkipFrames).toBe(4)
  })

  it('analysiert nur Vocalclips, berücksichtigt Quellbereich und Position und wählt eine Spur aus', async () => {
    vi.stubGlobal('Worker', TestWorker)
    const audio = new Blob(['a'])
    const tracks: AudioTrack[] = [
      { id: 'v1', projectId: 'p', type: 'vocal', name: 'Lead', createdAt: 1, clips: [{ id: 'a', name: 'a', audio, start: 4, sourceStart: 1, duration: 1 }] },
      { id: 'v2', projectId: 'p', type: 'vocal', name: 'Chor', createdAt: 2, clips: [{ id: 'b', name: 'b', audio, start: 8, duration: 1 }] },
      { id: 'i', projectId: 'p', type: 'instrumental', name: 'Piano', createdAt: 3, clips: [{ id: 'c', name: 'c', audio, start: 0, duration: 1 }] },
    ]
    const left = Float32Array.from([1, 2, 3, 4, 5, 6])
    const right = Float32Array.from([3, 4, 5, 6, 7, 8])
    const buffer = { sampleRate: 2, duration: 3, length: 6, numberOfChannels: 2, getChannelData: (channel: number) => channel ? right : left } as AudioBuffer
    const decoded = { a: { buffer }, b: { buffer }, c: { buffer } }
    const { container, unmount } = render(<ExerciseTuner tracks={tracks} decoded={decoded} position={4} duration={10} playing={false} seekVersion={0} controlsTarget={document.body} onSeek={vi.fn()} />)
    const worker = TestWorker.instance
    expect(worker.jobs).toHaveLength(1)
    expect(worker.jobs[0]).toMatchObject({ id: 'a', start: 4, sampleRate: 2 })
    expect([...worker.jobs[0].samples]).toEqual([4, 5])
    act(() => worker.complete('a', [{ timeMs: 4000, frequency: 220 }, { timeMs: 4500, frequency: 220 }]))
    expect(worker.jobs.map((job) => job.id)).toEqual(['a', 'b'])
    expect(container.querySelector('.tuner-reference-trace')?.getAttribute('d')).toContain('L')
    fireEvent.change(screen.getByLabelText('Vocalspur'), { target: { value: 'v2' } })
    expect(screen.getByRole('status')).toHaveTextContent('analysiert')
    act(() => worker.complete('b', [{ timeMs: 8000, frequency: 440 }]))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(worker.jobs).toHaveLength(2)
    unmount()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('zeigt Mikrofontöne synchron zur Wiedergabe und verwirft den Verlauf beim Springen', () => {
    mock.state = { status: 'listening', error: null, points: [{ timeMs: 50, frequency: 440 }], timeMs: 50 }
    const props = { tracks: [], decoded: {}, position: 2, duration: 10, playing: true, seekVersion: 0, controlsTarget: document.body, onSeek: vi.fn() }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    expect(screen.getByLabelText('Aktuelle Tonhöhe')).toHaveTextContent('A4')
    mock.state = { ...mock.state, points: [{ timeMs: 100, frequency: 440 }] }
    rerender(<ExerciseTuner {...props} position={2.05} />)
    expect(container.querySelector('.tuner-trace')?.getAttribute('d')).toContain('M')
    fireEvent.click(screen.getByRole('button', { name: 'Mikrofon stoppen' }))
    expect(mock.stop).toHaveBeenCalledOnce()
    rerender(<ExerciseTuner {...props} position={8} seekVersion={1} />)
    expect(container.querySelector('.tuner-trace')).toHaveAttribute('d', '')
    mock.state = { ...mock.state, points: [{ timeMs: 150, frequency: 440 }] }
    rerender(<ExerciseTuner {...props} position={8.05} seekVersion={1} />)
    expect(container.querySelector('.tuner-trace')?.getAttribute('d')).toContain('M')
  })

  it('meldet Fehler beim Starten der Analyse', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Nicht verfügbar') } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ExerciseTuner tracks={[{ id: 'v', projectId: 'p', type: 'vocal', name: '', createdAt: 1 }]} decoded={{}} position={0} duration={0} playing={false} seekVersion={0} controlsTarget={document.body} onSeek={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Tonhöhenanalyse konnte nicht gestartet werden')
    spy.mockRestore()
  })

  it('erhält während einer Pause keinen zeitlich falschen Mikrofonverlauf', () => {
    const props = { tracks: [], decoded: {}, position: 2, duration: 10, playing: false, seekVersion: 0, controlsTarget: document.body, onSeek: vi.fn() }
    mock.state = { status: 'listening', error: null, points: [{ timeMs: 100, frequency: 220 }], timeMs: 100 }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    mock.state = { ...mock.state, points: [{ timeMs: 200, frequency: 220 }] }
    rerender(<ExerciseTuner {...props} />)
    expect(container.querySelector('.tuner-trace')).toHaveAttribute('d', '')
    mock.state = { ...mock.state, points: [{ timeMs: 250, frequency: 220 }] }
    rerender(<ExerciseTuner {...props} playing />)
    expect(container.querySelector('.tuner-trace')?.getAttribute('d')).toContain('M')
  })

  it('behält den sichtbaren Tonbereich während einer ausgelassenen Messung bei', () => {
    const props = { tracks: [], decoded: {}, position: 2, duration: 10, playing: true, seekVersion: 0, controlsTarget: document.body, onSeek: vi.fn() }
    mock.state = { status: 'listening', error: null, points: [{ timeMs: 100, frequency: 880 }], timeMs: 100 }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    const notes = () => [...container.querySelectorAll('.tuner-grid-note text')].map((note) => note.textContent)
    const before = notes()
    expect(before).toContain('A5')
    mock.state = { ...mock.state, points: [{ timeMs: 100, frequency: 880 }, { timeMs: 150, frequency: null }] }
    rerender(<ExerciseTuner {...props} position={2.05} />)
    expect(notes()).toEqual(before)
    expect(screen.getByLabelText('Aktuelle Tonhöhe')).toHaveTextContent('– Hz')
  })
})
