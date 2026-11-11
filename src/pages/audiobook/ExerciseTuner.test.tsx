import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PitchPoint } from '../../features/tuner/pitch'
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
  vi.unstubAllGlobals()
  mock.state = { status: 'idle', error: null, points: [], timeMs: 0 }
  mock.start.mockReset()
  mock.stop.mockReset()
})

describe('Übungsstimmgerät', () => {
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
    const { container, unmount } = render(<ExerciseTuner tracks={tracks} decoded={decoded} position={4} playing={false} seekVersion={0} />)
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
    const props = { tracks: [], decoded: {}, position: 2, playing: true, seekVersion: 0 }
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
    render(<ExerciseTuner tracks={[{ id: 'v', projectId: 'p', type: 'vocal', name: '', createdAt: 1 }]} decoded={{}} position={0} playing={false} seekVersion={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Tonhöhenanalyse konnte nicht gestartet werden')
    spy.mockRestore()
  })

  it('erhält während einer Pause keinen zeitlich falschen Mikrofonverlauf', () => {
    const props = { tracks: [], decoded: {}, position: 2, playing: false, seekVersion: 0 }
    mock.state = { status: 'listening', error: null, points: [{ timeMs: 100, frequency: 220 }], timeMs: 100 }
    const { container, rerender } = render(<ExerciseTuner {...props} />)
    mock.state = { ...mock.state, points: [{ timeMs: 200, frequency: 220 }] }
    rerender(<ExerciseTuner {...props} />)
    expect(container.querySelector('.tuner-trace')).toHaveAttribute('d', '')
    mock.state = { ...mock.state, points: [{ timeMs: 250, frequency: 220 }] }
    rerender(<ExerciseTuner {...props} playing />)
    expect(container.querySelector('.tuner-trace')?.getAttribute('d')).toContain('M')
  })
})
