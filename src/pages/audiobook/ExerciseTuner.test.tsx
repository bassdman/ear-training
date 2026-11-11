import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PitchPoint } from '../../features/tuner/pitch'
import { DEFAULT_TUNER_SETTINGS, TUNER_SETTINGS_STORAGE_KEY } from '../../features/tuner/settings'
import type { AudioTrack } from './audioStorage'
import { ExerciseTuner } from './ExerciseTuner'
import type { ReferencePitchJob, ReferencePitchPoint } from './referencePitch'
import * as debugTrace from './debugTrace'

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
  complete(id: string, points: (PitchPoint | ReferencePitchPoint)[]) {
    this.onmessage?.({ data: { id, points: points.map((point) => ({ rawFrequency: point.frequency, ...point })) } } as MessageEvent)
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mock.state = { status: 'idle', error: null, points: [], timeMs: 0 }
  mock.start.mockReset()
  mock.stop.mockReset()
})

describe('Übungsstimmgerät', () => {
  it('zeigt zur Songzeit passende Skalenstriche und Raster und spult per Klick und Tastatur', () => {
    const onSeek = vi.fn()
    const props = { tracks: [], decoded: {}, position: 5, duration: 10, playing: true, seekVersion: 0, controlsTarget: null, onSeek }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    const ruler = screen.getByRole('slider', { name: 'Wiedergabeposition auf der Übungszeitleiste' })
    vi.spyOn(ruler, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect)
    const ticks = [...ruler.querySelectorAll<HTMLElement>('.exercise-tuner-tick')]
    expect(ticks.map((tick) => tick.textContent)).toEqual(['4 s', '6 s'])
    expect(parseFloat(ticks[0].style.left)).toBeCloseTo(33.5)
    expect(parseFloat(ticks[1].style.left)).toBeCloseTo(71.5)
    const lines = [...container.querySelectorAll('.tuner-grid-time line')]
    expect(Number(lines[0].getAttribute('x1'))).toBeCloseTo(134)
    expect(Number(lines[1].getAttribute('x1'))).toBeCloseTo(286)
    fireEvent.click(ruler, { clientX: 386 })
    expect(onSeek).toHaveBeenLastCalledWith(6)
    fireEvent.keyDown(ruler, { key: 'ArrowLeft' })
    expect(onSeek).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(ruler, { key: 'End' })
    expect(onSeek).toHaveBeenLastCalledWith(10)
    rerender(<ExerciseTuner {...props} position={0} />)
    expect([...ruler.querySelectorAll('.exercise-tuner-tick')].map((tick) => tick.textContent)).toEqual(['0 s', '2 s'])
    onSeek.mockClear()
    fireEvent.click(ruler, { clientX: 100 })
    expect(onSeek).not.toHaveBeenCalled()
    rerender(<ExerciseTuner {...props} position={10} />)
    expect([...ruler.querySelectorAll('.exercise-tuner-tick')].map((tick) => tick.textContent)).toEqual(['8 s', '10 s'])
    expect(ruler.querySelector('.exercise-tuner-tick.is-right')).toBeNull()
    rerender(<ExerciseTuner {...props} position={7.5} />)
    expect(ruler.querySelector('.exercise-tuner-tick.is-right')).toHaveTextContent('10 s')
    fireEvent.click(ruler, { clientX: 600 })
    expect(onSeek).toHaveBeenLastCalledWith(10)
  })

  it('exportiert nur die ausgewählte vollständig analysierte Vocalspur samt Rohdaten und Songzeit', () => {
    vi.stubGlobal('Worker', TestWorker)
    const download = vi.spyOn(debugTrace, 'downloadVocalDebugTrace').mockImplementation(() => {})
    const target = document.createElement('div')
    document.body.append(target)
    const audio = new Blob(['a'])
    const tracks: AudioTrack[] = [
      { id: 'v1', projectId: 'p', type: 'vocal', name: 'Lead', createdAt: 1, clips: [{ id: 'a', name: 'a', audio, start: 4, sourceStart: 1, duration: 1 }] },
      { id: 'v2', projectId: 'p', type: 'vocal', name: 'Chor', createdAt: 2, clips: [{ id: 'b', name: 'b', audio, start: 8, duration: 1 }] },
    ]
    const buffer: AudioBuffer = { sampleRate: 2, duration: 3, length: 6, numberOfChannels: 1, getChannelData: () => new Float32Array(6), copyFromChannel: vi.fn(), copyToChannel: vi.fn() }
    const close = vi.fn()
    const { unmount } = render(<ExerciseTuner tracks={tracks} decoded={{ a: { buffer }, b: { buffer } }} position={0} duration={9} playing={false} seekVersion={0} controlsTarget={null} onSeek={vi.fn()} traceMenuTarget={target} onTraceDownload={close} />)
    const button = screen.getByRole('button', { name: 'Debug-Trace herunterladen' })
    expect(button).toBeDisabled()
    act(() => TestWorker.instance.complete('a', [
      { timeMs: 4000, frequency: 220, rawFrequency: 220 },
      { timeMs: 4050, frequency: null, rawFrequency: 440 },
    ]))
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(close).toHaveBeenCalledOnce()
    expect(download).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p', track: { id: 'v1', name: 'Lead', number: 1 },
      version: 2,
      analysis: expect.objectContaining({ octaveSkipFrames: 2, minimumJumpSemitones: 10, analysisIntervalMs: 50 }),
      points: [
        { timeSeconds: 4, clipId: 'a', kind: 'sample', frequencyHz: 220, note: 'A3', rawFrequencyHz: 220, rawNote: 'A3' },
        { timeSeconds: 4.05, clipId: 'a', kind: 'sample', frequencyHz: null, note: null, rawFrequencyHz: 440, rawNote: 'A4' },
        { timeSeconds: 5, clipId: 'a', kind: 'clip-end', frequencyHz: null, note: null, rawFrequencyHz: null, rawNote: null },
      ],
    }))
    fireEvent.change(screen.getByLabelText('Vocalspur'), { target: { value: 'v2' } })
    expect(button).toBeDisabled()
    act(() => TestWorker.instance.complete('b', [{ timeMs: 8000, frequency: 440 }]))
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(download.mock.lastCall?.[0].track.id).toBe('v2')
    expect(download.mock.lastCall?.[0].points[0].timeSeconds).toBe(8)
    download.mockImplementation(() => { throw new Error('Download blockiert') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fireEvent.click(button)
    expect(screen.getByRole('alert')).toHaveTextContent('Debug-Trace konnte nicht heruntergeladen werden')
    expect(log).toHaveBeenCalledOnce()
    unmount()
    target.remove()
  })

  it('bietet bei einer fehlgeschlagenen Clipanalyse keinen unvollständigen Trace an', () => {
    vi.stubGlobal('Worker', TestWorker)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = document.createElement('div')
    document.body.append(target)
    const track: AudioTrack = { id: 'v', projectId: 'p', type: 'vocal', name: 'Lead', createdAt: 1, clips: [{ id: 'a', name: 'a', audio: new Blob(['a']), start: 0, duration: 1 }] }
    const buffer: AudioBuffer = { sampleRate: 2, duration: 1, length: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(2), copyFromChannel: vi.fn(), copyToChannel: vi.fn() }
    const { unmount } = render(<ExerciseTuner tracks={[track]} decoded={{ a: { buffer } }} position={0} duration={1} playing={false} seekVersion={0} controlsTarget={null} onSeek={vi.fn()} traceMenuTarget={target} />)
    act(() => TestWorker.instance.onmessage?.({ data: { id: 'a', error: 'Fehler' } } as MessageEvent))
    expect(screen.getByRole('alert')).toHaveTextContent('Audioblock konnte nicht analysiert werden')
    expect(screen.getByRole('button', { name: 'Debug-Trace herunterladen' })).toBeDisabled()
    expect(log).toHaveBeenCalledOnce()
    unmount()
    target.remove()
  })

  it('hält die Tonhöhenansicht beim Ziehen fest und führt sie nach dem Abbruch wieder nach', () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.isPrimary = init.isPrimary ?? false
      }
    }
    let time = 0
    let id = 0
    const frames = new Map<number, FrameRequestCallback>()
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
    const advance = () => {
      time += 100
      const callbacks = [...frames.values()]
      frames.clear()
      act(() => callbacks.forEach((callback) => callback(time)))
    }
    const props = { tracks: [], decoded: {}, position: 5, duration: 10, playing: true, seekVersion: 0, controlsTarget: null, onSeek: vi.fn() }
    mock.state = { status: 'listening', error: null, points: [{ timeMs: 100, frequency: 440 }], timeMs: 100 }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    const chart = screen.getByRole('slider', { name: 'Wiedergabeposition im Stimmgerät' })
    chart.setPointerCapture = vi.fn()
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect)
    const noteY = () => [...container.querySelectorAll('.tuner-grid-note')].find((item) => item.querySelector('text')?.textContent === 'A4')?.querySelector('line')?.getAttribute('y1')
    const initialY = noteY()
    mock.state = { ...mock.state, points: [{ timeMs: 150, frequency: 880 }] }
    rerender(<ExerciseTuner {...props} />)
    expect(noteY()).toBe(initialY)
    advance()
    expect(noteY()).toBe(initialY)
    mock.state = { ...mock.state, points: [{ timeMs: 175, frequency: 1760 }] }
    rerender(<ExerciseTuner {...props} />)
    advance()
    expect(noteY()).not.toBe(initialY)
    fireEvent.pointerDown(chart, { pointerId: 1, isPrimary: true, button: 0, clientX: 200 })
    const frozenY = noteY()
    mock.state = { ...mock.state, points: [{ timeMs: 200, frequency: 3520 }] }
    rerender(<ExerciseTuner {...props} position={6} />)
    advance()
    expect(noteY()).toBe(frozenY)
    fireEvent.pointerCancel(chart, { pointerId: 1 })
    advance()
    expect(noteY()).not.toBe(frozenY)
  })

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
    fireEvent.change(screen.getByLabelText('Große Tonsprünge: Frames überspringen'), { target: { value: '4' } })
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
