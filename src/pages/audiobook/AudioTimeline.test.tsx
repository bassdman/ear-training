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
const importProps = { onImport: vi.fn(), onMove: vi.fn(), busy: false }

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
    buffer: { duration: 30 } as AudioBuffer,
    waveform: { duration: 30, peaks: new Float32Array(3000).fill(0.5), peaksPerSecond: 100 },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('gemeinsame Zeitleiste', () => {
  it('zeigt alle Spuren und skaliert Wellenformen und Sekundenmarkierungen gemeinsam', async () => {
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    expect(screen.getByRole('group', { name: 'Einstellungen für Spur 1: Gesang' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Einstellungen für Spur 2: Gitarre' })).toBeInTheDocument()
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    const inner = viewport.firstElementChild as HTMLElement
    expect(inner.style.width).toBe('1601px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    expect(inner.style.width).toBe('2401px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 100 })
    expect(parseFloat(inner.style.width)).toBeGreaterThan(2401)
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
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht geladen werden')
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeDisabled()
  })

  it('dekodiert eine laufende Spur weiter, wenn eine neue hinzugefügt wird', async () => {
    let finish: (value: Awaited<ReturnType<typeof decodeWaveform>>) => void = () => {}
    vi.mocked(decodeWaveform).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { rerender, container } = render(<AudioTimeline tracks={tracks.slice(0, 1)} onMixChange={vi.fn()} {...importProps} />)
    rerender(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    finish({ buffer: { duration: 10 } as AudioBuffer, waveform: { duration: 10, peaks: new Float32Array(1000), peaksPerSecond: 100 } })
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    expect(decodeWaveform).toHaveBeenCalledTimes(2)
  })

  it('setzt die gemeinsame Position per Klick und Tastatur auch nach horizontalem Scrollen', async () => {
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    viewport.scrollLeft = 200
    fireEvent.scroll(viewport)
    fireEvent.click(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { clientX: 120 })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('8.0 / 30.0 s')
    expect(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' })).toHaveAttribute('aria-valuenow', '8')
    const rulerPlayhead = container.querySelector<HTMLElement>('.audiobook-ruler .audiobook-playhead')
    const trackPlayhead = container.querySelector<HTMLElement>('.audiobook-timeline-inner > .audiobook-track-playhead')
    expect(rulerPlayhead).toHaveStyle({ left: '120px' })
    expect(trackPlayhead).toHaveStyle({ left: '320px' })
    expect(trackPlayhead).toHaveAttribute('aria-hidden', 'true')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'ArrowRight' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('9.0 / 30.0 s')
    expect(rulerPlayhead).toHaveStyle({ left: '160px' })
    expect(trackPlayhead).toHaveStyle({ left: '360px' })
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    expect(trackPlayhead).toHaveStyle({ left: '540px' })
    expect(parseFloat(rulerPlayhead?.style.left ?? '') + viewport.scrollLeft).toBe(540)
  })

  it('verschiebt Blöcke per Tastatur, ohne die Wiedergabeposition zu verändern', async () => {
    const onMove = vi.fn()
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} onImport={vi.fn()} onMove={onMove} busy={false} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const clip = screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.click(clip)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('0.0 / 30.0 s')
    fireEvent.keyDown(clip, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenLastCalledWith('one', 'one', 'one:legacy', 1, { 'one:legacy': 30, 'two:legacy': 30 })
    fireEvent.keyDown(clip, { key: 'ArrowDown' })
    expect(onMove).toHaveBeenLastCalledWith('one', 'two', 'one:legacy', 0, { 'one:legacy': 30, 'two:legacy': 30 })
  })

  it('bietet pro Spur eigene Lautstärke- und Mute-Steuerung an', async () => {
    const onMixChange = vi.fn()
    const { rerender, container } = render(<AudioTimeline tracks={tracks} onMixChange={onMixChange} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const mute = screen.getByRole('button', { name: 'Spur 1: Gesang stummschalten' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(mute)
    expect(onMixChange).toHaveBeenLastCalledWith('one', { muted: true })
    fireEvent.click(screen.getByRole('button', { name: 'Lautstärke für Spur 1: Gesang' }))
    const volume = screen.getByRole('slider', { name: 'Lautstärke Spur 1: Gesang' })
    fireEvent.change(volume, { target: { value: '35' } })
    expect(onMixChange).toHaveBeenLastCalledWith('one', { volume: 0.35 })
    rerender(<AudioTimeline tracks={[{ ...tracks[0], muted: true, volume: 0.35 }, tracks[1]]} onMixChange={onMixChange} {...importProps} />)
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    expect(mute).toHaveClass('is-muted')
    const firstRow = screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' }).closest('.audiobook-wave-row')
    const secondRow = screen.getByRole('button', { name: 'Audioblock Gitarre in Spur 2 verschieben' }).closest('.audiobook-wave-row')
    expect(firstRow).toHaveClass('is-muted')
    expect(secondRow).not.toHaveClass('is-muted')
    expect(volume).toHaveValue('35')
    expect(screen.getByRole('button', { name: 'Spur 2: Gitarre stummschalten' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<AudioTimeline tracks={tracks} onMixChange={onMixChange} {...importProps} />)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(firstRow).not.toHaveClass('is-muted')
    expect(decodeWaveform).toHaveBeenCalledTimes(2)
  })

  it('zeichnet unterschiedlich lange Blöcke maßstabsgetreu und importiert an der angeklickten Position', async () => {
    const onImport = vi.fn()
    const first = { id: 'a', name: 'lang.wav', audio: new Blob(['a']), start: 0, duration: 30 }
    const second = { id: 'b', name: 'kurz.wav', audio: new Blob(['b']), start: 5, duration: 15 }
    vi.mocked(decodeWaveform).mockImplementation(async (blob) => {
      const duration = blob === first.audio ? 30 : 15
      return { buffer: { duration } as AudioBuffer, waveform: { duration, peaks: new Float32Array(duration * 100), peaksPerSecond: 100 } }
    })
    const clipTracks: AudioTrack[] = [
      { ...tracks[0], audio: undefined, clips: [first] },
      { ...tracks[1], audio: undefined, clips: [second] },
    ]
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1600)
    const { container } = render(<AudioTimeline tracks={clipTracks} onMixChange={vi.fn()} onImport={onImport} onMove={vi.fn()} busy={false} />)
    await waitFor(() => expect(container.querySelectorAll('.audiobook-clip')).toHaveLength(2))
    const blocks = container.querySelectorAll<HTMLElement>('.audiobook-clip')
    expect(blocks[0].style.width).toBe('1200px')
    expect(blocks[1].style.width).toBe('600px')
    expect(blocks[1].style.left).toBe('200px')
    fireEvent.click(screen.getByRole('button', { name: 'Freier Bereich in Spur 2' }), { clientX: 1000, clientY: 20, detail: 1 })
    const input = screen.getByLabelText('Importieren')
    expect(input).not.toHaveAttribute('accept')
    const file = new File(['a'], 'neu.m4a', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onImport).toHaveBeenCalledWith('two', 25, { b: 15 }, file)

    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    viewport.scrollLeft = 200
    fireEvent.scroll(viewport)
    fireEvent.click(screen.getByRole('button', { name: 'Freier Bereich in Spur 2' }))
    fireEvent.change(screen.getByLabelText('Importieren'), { target: { files: [file] } })
    expect(onImport).toHaveBeenLastCalledWith('two', 5, { b: 15 }, file)
  })
})
