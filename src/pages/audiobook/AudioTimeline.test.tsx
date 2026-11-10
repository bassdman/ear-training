import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AudioTrack } from './audioStorage'
import { AudioTimeline } from './AudioTimeline'
import { decodeWaveform } from './waveform'

vi.mock('./waveform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./waveform')>()
  return { ...actual, decodeWaveform: vi.fn() }
})

const tracks: AudioTrack[] = [
  { id: 'one', projectId: 'project', name: 'Gesang', audio: new Blob(['a']), createdAt: 1 },
  { id: 'two', projectId: 'project', name: 'Gitarre', audio: new Blob(['b']), createdAt: 2 },
]

beforeEach(() => {
  vi.mocked(decodeWaveform).mockReset()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(), fillRect: vi.fn(), fillStyle: '',
  } as unknown as CanvasRenderingContext2D)
  vi.mocked(decodeWaveform).mockResolvedValue({
    duration: 30, peaks: new Float32Array(3000).fill(0.5), peaksPerSecond: 100,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('gemeinsame Zeitleiste', () => {
  it('zeigt alle Spuren und skaliert Wellenformen und Sekundenmarkierungen gemeinsam', async () => {
    const { container } = render(<AudioTimeline tracks={tracks} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    expect(screen.getByText('Spur 1: Gesang')).toBeInTheDocument()
    expect(screen.getByText('Spur 2: Gitarre')).toBeInTheDocument()
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    const inner = viewport.firstElementChild as HTMLElement
    expect(inner.style.width).toBe('1201px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    expect(inner.style.width).toBe('1801px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 100 })
    expect(parseFloat(inner.style.width)).toBeGreaterThan(1801)
    expect(screen.getByText('3 s')).toBeInTheDocument()
    expect(screen.getByText('4 s')).toBeInTheDocument()
    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    viewport.scrollLeft = 500
    fireEvent.scroll(viewport)
    expect(screen.getByText('6 s')).toBeInTheDocument()
    expect(container.querySelectorAll('.audiobook-wave-visible')).toHaveLength(2)
  })

  it('meldet einen Dekodierfehler nur für die betroffene Spur', async () => {
    vi.mocked(decodeWaveform).mockRejectedValueOnce(new Error('unsupported'))
    const { container } = render(<AudioTimeline tracks={tracks} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Wellenform konnte nicht geladen werden')
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
  })

  it('dekodiert eine laufende Spur weiter, wenn eine neue hinzugefügt wird', async () => {
    let finish: (value: Awaited<ReturnType<typeof decodeWaveform>>) => void = () => {}
    vi.mocked(decodeWaveform).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { rerender, container } = render(<AudioTimeline tracks={tracks.slice(0, 1)} />)
    rerender(<AudioTimeline tracks={tracks} />)
    finish({ duration: 10, peaks: new Float32Array(1000), peaksPerSecond: 100 })
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    expect(decodeWaveform).toHaveBeenCalledTimes(2)
  })
})
