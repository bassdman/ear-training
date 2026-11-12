import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const importProps = { onImport: vi.fn(), onPaste: vi.fn(), onMove: vi.fn(), onSplit: vi.fn(), onDelete: vi.fn(), onDeleteTrack: vi.fn(), busy: false }

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
  Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
  Reflect.deleteProperty(document, 'elementFromPoint')
})

describe('gemeinsame Zeitleiste', () => {
  it('spielt im Übungsmodus ohne Spuransicht und zeigt das Mikrofon in der Wiedergabeleiste', async () => {
    const onMove = vi.fn()
    const onImport = vi.fn()
    const onMixChange = vi.fn()
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={onMixChange} {...importProps} onMove={onMove} onImport={onImport} readOnly />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abspielen' })).toBeEnabled())
    expect(container.querySelector('.audiobook-timeline-section')).not.toBeInTheDocument()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(onMove).not.toHaveBeenCalled()
    expect(onImport).not.toHaveBeenCalled()
    expect(onMixChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Freier Bereich|Optionen für Spur|stummschalten|Kopieren|Löschen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' })).not.toBeInTheDocument()
    const bar = screen.getByLabelText('Wiedergabesteuerung')
    expect(within(bar).getByRole('button', { name: 'Mikrofon starten' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Abspielen' })).toBeEnabled()
    expect(within(bar).getByRole('button', { name: 'Vocalspur auswählen' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Stimmgerät-Einstellungen' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Stimmgerät zum Üben' })).queryByRole('button', { name: 'Stimmgerät-Einstellungen' })).not.toBeInTheDocument()
  })

  it('spult im Übungsmodus über das Stimmgerät und setzt die Wiedergabe fort', async () => {
    const start = vi.fn()
    class TestContext {
      state = 'running'
      currentTime = 0
      destination = {}
      createBufferSource() { return { connect: vi.fn(), disconnect: vi.fn(), start, stop: vi.fn(), buffer: null } }
      createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() } }
      close = vi.fn(async () => {})
    }
    vi.stubGlobal('AudioContext', TestContext)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} readOnly />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abspielen' })).toBeEnabled())
    const chart = screen.getByRole('slider', { name: 'Wiedergabeposition im Stimmgerät' })
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('1.0 / 30.0 s')
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('2.0 / 30.0 s')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(start).toHaveBeenLastCalledWith(0, 2, 28)
    const ruler = screen.getByRole('slider', { name: 'Wiedergabeposition auf der Übungszeitleiste' })
    vi.spyOn(ruler, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 400 } as DOMRect)
    fireEvent.click(ruler, { clientX: 286 })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('3.0 / 30.0 s')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(start).toHaveBeenLastCalledWith(0, 3, 27)
    fireEvent.keyDown(chart, { key: 'End' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('30.0 / 30.0 s')
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument()
  })

  it('schließt geöffnete Bearbeitungsmenüs beim Wechsel der Ansicht', async () => {
    const { rerender } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    const clip = await screen.findByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeInTheDocument()
    rerender(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} readOnly />)
    expect(screen.queryByRole('button', { name: 'Kopieren' })).not.toBeInTheDocument()
    rerender(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Kopieren' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('kennzeichnet Spurarten und erhält die graue Darstellung bei Stummschaltung', async () => {
    const typedTracks: AudioTrack[] = [
      { ...tracks[0], type: 'vocal' },
      { ...tracks[1], type: 'instrumental', muted: true },
      { id: 'three', projectId: 'project', name: '', clips: [], createdAt: 3 },
    ]
    const { container } = render(<AudioTimeline tracks={typedTracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const rows = container.querySelectorAll('.audiobook-wave-row')
    expect(rows[0]).toHaveAttribute('data-track-type', 'vocal')
    expect(rows[1]).toHaveAttribute('data-track-type', 'instrumental')
    expect(rows[1]).toHaveClass('is-muted')
    expect(rows[2]).toHaveAttribute('data-track-type', 'mixed')
    expect(screen.getByText('Vocal')).toBeInTheDocument()
    expect(screen.getByText('Instrumental')).toBeInTheDocument()
    expect(screen.getByText('Mixed')).toBeInTheDocument()
  })

  it('zeigt alle Spuren und skaliert Wellenformen und Sekundenmarkierungen gemeinsam', async () => {
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    expect(screen.getByRole('group', { name: 'Einstellungen für Spur 1: Gesang' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Einstellungen für Spur 2: Gitarre' })).toBeInTheDocument()
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    const inner = viewport.firstElementChild as HTMLElement
    expect(inner.style.width).toBe('1600px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    expect(inner.style.width).toBe('2200px')
    expect(screen.getByText('2 s')).toBeInTheDocument()
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 100 })
    expect(parseFloat(inner.style.width)).toBeGreaterThan(2200)
    expect(screen.getByText('1 s')).toBeInTheDocument()
    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    viewport.scrollLeft = 500
    fireEvent.scroll(viewport)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).not.toHaveTextContent('0.0 / 30.0 s')
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
    const rulerPlayhead = container.querySelector<HTMLElement>('.audiobook-ruler .audiobook-playhead')
    const trackPlayhead = container.querySelector<HTMLElement>('.audiobook-timeline-inner > .audiobook-track-playhead')
    const clip = container.querySelector<HTMLElement>('.audiobook-clip')
    expect(rulerPlayhead).toHaveStyle({ left: '50%' })
    expect(trackPlayhead).toHaveStyle({ left: '200px' })
    expect(clip).toHaveStyle({ left: '200px' })
    viewport.scrollLeft = 200
    fireEvent.scroll(viewport)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('5.0 / 30.0 s')
    expect(trackPlayhead).toHaveStyle({ left: '400px' })
    expect(clip).toHaveStyle({ left: '0px' })
    fireEvent.click(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { clientX: 120 })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('3.0 / 30.0 s')
    expect(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' })).toHaveAttribute('aria-valuenow', '3')
    expect(rulerPlayhead).toHaveStyle({ left: '50%' })
    expect(trackPlayhead).toHaveStyle({ left: '320px' })
    expect(trackPlayhead).toHaveAttribute('aria-hidden', 'true')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'ArrowRight' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('4.0 / 30.0 s')
    expect(rulerPlayhead).toHaveStyle({ left: '50%' })
    expect(trackPlayhead).toHaveStyle({ left: '360px' })
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    expect(trackPlayhead).toHaveStyle({ left: '440px' })
    expect(viewport.scrollLeft).toBe(240)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'End' })
    expect(viewport.scrollLeft).toBe(1800)
    expect(trackPlayhead).toHaveStyle({ left: '2000px' })
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('30.0 / 30.0 s')
  })

  it('bewegt während der Wiedergabe die Spuren unter der mittigen Positionslinie', async () => {
    let frame: FrameRequestCallback | undefined
    const clock = { time: 0 }
    class TestContext {
      state = 'running'
      get currentTime() { return clock.time }
      destination = {}
      createBufferSource() { return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null } }
      createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() } }
      close = vi.fn(async () => {})
    }
    vi.stubGlobal('AudioContext', TestContext)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    const clip = container.querySelector<HTMLElement>('.audiobook-clip')
    const marker = container.querySelector<HTMLElement>('.audiobook-track-playhead')
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    act(() => {
      clock.time = 2
      frame?.(0)
    })
    expect(viewport.scrollLeft).toBe(80)
    expect(clip).toHaveStyle({ left: '120px' })
    expect(marker).toHaveStyle({ left: '280px' })
    fireEvent.scroll(viewport)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('2.0 / 30.0 s')
  })

  it('verschiebt Blöcke per Tastatur, ohne die Wiedergabeposition zu verändern', async () => {
    const onMove = vi.fn()
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} onMove={onMove} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const clip = screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.click(clip)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('0.0 / 30.0 s')
    fireEvent.keyDown(clip, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenLastCalledWith('one', 'one', 'one:legacy', 1, { 'one:legacy': 30, 'two:legacy': 30 })
    fireEvent.keyDown(clip, { key: 'ArrowDown' })
    expect(onMove).toHaveBeenLastCalledWith('one', 'two', 'one:legacy', 0, { 'one:legacy': 30, 'two:legacy': 30 })
  })

  it('markiert einen Block und bietet Schneiden nur innerhalb seiner Grenzen an', async () => {
    const onSplit = vi.fn()
    render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} onSplit={onSplit} />)
    const clip = await screen.findByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    expect(clip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Schneiden' })).not.toBeInTheDocument()
    fireEvent.keyDown(clip, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Schneiden' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Schneiden' }))
    expect(onSplit).toHaveBeenCalledWith('one', 'one:legacy', 1, 30)
    expect(clip).toHaveAttribute('aria-pressed', 'false')
  })

  it('kopiert einen Block und bietet wiederholtes Einfügen an der angeklickten Position an', async () => {
    const audio = new Blob(['a'])
    const clipTracks: AudioTrack[] = [
      { ...tracks[0], audio: undefined, clips: [{ id: 'clip', name: 'Schnitt', audio, start: 2, sourceStart: 10, duration: 7 }] },
      { ...tracks[1], audio: undefined, clips: [] },
    ]
    const onPaste = vi.fn()
    render(<AudioTimeline tracks={clipTracks} onMixChange={vi.fn()} {...importProps} onPaste={onPaste} />)
    const empty = screen.getByRole('button', { name: 'Freier Bereich in Spur 2' })
    fireEvent.click(empty, { detail: 1, clientX: 320, clientY: 10 })
    expect(screen.queryByRole('button', { name: 'Einfügen' })).not.toBeInTheDocument()
    const clip = await screen.findByRole('button', { name: 'Audioblock Schnitt in Spur 1 verschieben' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Blockmenü schließen' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kopieren' }))
    fireEvent.click(empty, { detail: 1, clientX: 320, clientY: 10 })
    expect(screen.queryByRole('button', { name: 'Importmenü schließen' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }))
    expect(onPaste).toHaveBeenCalledWith('two', 3, { clip: 7 }, expect.objectContaining({ id: 'clip', audio, sourceStart: 10, duration: 7, audioId: expect.any(String) }))
    fireEvent.click(empty, { detail: 1, clientX: 360, clientY: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }))
    expect(onPaste).toHaveBeenCalledTimes(2)
    expect(onPaste).toHaveBeenLastCalledWith('two', 4, { clip: 7 }, expect.any(Object))
  }, 15000)

  it('öffnet Spuroptionen, bestätigt das Löschen und schließt Menüs mit Escape', async () => {
    const onDeleteTrack = vi.fn()
    render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} onDeleteTrack={onDeleteTrack} />)
    const options = screen.getByRole('button', { name: 'Optionen für Spur 1: Gesang' })
    expect(screen.queryByRole('slider', { name: 'Lautstärke Spur 1: Gesang' })).not.toBeInTheDocument()
    fireEvent.click(options)
    expect(options).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('slider', { name: 'Lautstärke Spur 1: Gesang' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Spur löschen' }))
    expect(screen.getByText('Spur und alle ihre Audioblöcke löschen?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onDeleteTrack).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(options).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(options)
    fireEvent.click(screen.getByRole('button', { name: 'Spur löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(onDeleteTrack).toHaveBeenCalledExactlyOnceWith('one')
  }, 15000)

  it('bietet Löschen auch außerhalb der Schnittposition an und löscht erst nach Bestätigung', async () => {
    const onDelete = vi.fn()
    render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} onDelete={onDelete} />)
    const clip = await screen.findByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    fireEvent.keyDown(clip, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Schneiden' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('one', 'one:legacy')
    expect(clip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Endgültig löschen' })).not.toBeInTheDocument()
  }, 15000)

  it('zeichnet geschnittene Blöcke mit ihren Quelldauern und dekodiert gemeinsame Audiodaten nur einmal', async () => {
    const audio = new Blob(['shared'])
    const splitTracks: AudioTrack[] = [{
      ...tracks[0], audio: undefined, clips: [
        { id: 'a', name: 'Schnitt', audio, start: 0, duration: 5, sourceStart: 0 },
        { id: 'b', name: 'Schnitt', audio, start: 5, duration: 25, sourceStart: 5 },
      ],
    }]
    const { container } = render(<AudioTimeline tracks={splitTracks} onMixChange={vi.fn()} {...importProps} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'ArrowRight' })
    await waitFor(() => expect(container.querySelectorAll('.audiobook-clip')).toHaveLength(2))
    expect(container.querySelector<HTMLElement>('.audiobook-clip')?.style.width).toBe('200px')
    expect(decodeWaveform).toHaveBeenCalledTimes(1)
  })

  it('scrollt beim Ziehen an beiden Rändern eine halbe Ansichtsbreite pro Sekunde und erlaubt Ziele hinter dem Songende', async () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      pointerType: string
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
    let callback: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn((frame: FrameRequestCallback) => { callback = frame; return 1 }))
    const cancel = vi.fn(() => { callback = undefined })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const onMove = vi.fn()
    const { container } = render(<AudioTimeline tracks={tracks} onMixChange={vi.fn()} {...importProps} onMove={onMove} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 400, width: 400, top: 0, bottom: 254, height: 254, x: 0, y: 0, toJSON: () => ({}) })
    const row = container.querySelector<HTMLElement>('.audiobook-wave-seek')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => row) })
    const clip = screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.pointerDown(clip, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 210, clientY: 50 })
    fireEvent.pointerMove(viewport, { pointerId: 1, pointerType: 'mouse', clientX: 390, clientY: 50 })
    act(() => callback?.(0))
    act(() => callback?.(1000))
    expect(viewport.scrollLeft).toBe(200)
    expect(container.querySelector<HTMLElement>('.audiobook-clip-preview')).toHaveStyle({ left: '380px' })
    act(() => callback?.(6000))
    expect(viewport.scrollLeft).toBe(1200)
    act(() => callback?.(7000))
    expect(viewport.scrollLeft).toBe(1400)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('35.0 / 30.0 s')
    expect(container.querySelector('.audiobook-clip')).toBeNull()

    fireEvent.pointerMove(viewport, { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 50 })
    act(() => callback?.(8000))
    act(() => callback?.(9000))
    expect(viewport.scrollLeft).toBe(1200)
    fireEvent.pointerUp(viewport, { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 50 })
    expect(onMove).toHaveBeenCalledWith('one', 'one', 'one:legacy', 25, { 'one:legacy': 30, 'two:legacy': 30 })
    expect(cancel).toHaveBeenCalled()
    expect(callback).toBeUndefined()
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('30.0 / 30.0 s')

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { key: 'Home' })
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    const zoomedClip = screen.getByRole('button', { name: 'Audioblock Gesang in Spur 1 verschieben' })
    fireEvent.pointerDown(zoomedClip, { pointerId: 2, pointerType: 'touch', clientX: 210, clientY: 50 })
    fireEvent.pointerMove(viewport, { pointerId: 2, pointerType: 'touch', clientX: 390, clientY: 50 })
    act(() => callback?.(10000))
    act(() => callback?.(11000))
    expect(viewport.scrollLeft).toBe(200)
    expect(screen.getByLabelText('Aktuelle Wiedergabeposition')).toHaveTextContent('3.3 / 30.0 s')
    fireEvent.pointerMove(viewport, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 50 })
    expect(callback).toBeUndefined()
    fireEvent.pointerMove(viewport, { pointerId: 2, pointerType: 'touch', clientX: 390, clientY: 50 })
    expect(callback).toBeDefined()
    fireEvent.pointerCancel(viewport, { pointerId: 2, pointerType: 'touch' })
    expect(callback).toBeUndefined()
    expect(onMove).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(zoomedClip, { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 210, clientY: 50 })
    fireEvent.pointerMove(viewport, { pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 50 })
    act(() => callback?.(12000))
    act(() => callback?.(13000))
    act(() => callback?.(14000))
    expect(viewport.scrollLeft).toBe(0)
    fireEvent.lostPointerCapture(viewport, { pointerId: 3, pointerType: 'mouse' })
    expect(callback).toBeUndefined()
    expect(onMove).toHaveBeenCalledTimes(1)
  })

  it('bietet pro Spur eigene Lautstärke- und Mute-Steuerung an', async () => {
    const onMixChange = vi.fn()
    const { rerender, container } = render(<AudioTimeline tracks={tracks} onMixChange={onMixChange} {...importProps} />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))
    const mute = screen.getByRole('button', { name: 'Spur 1: Gesang stummschalten' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(mute)
    expect(onMixChange).toHaveBeenLastCalledWith('one', { muted: true })
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Spur 1: Gesang' }))
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
    const { container } = render(<AudioTimeline tracks={clipTracks} onMixChange={vi.fn()} {...importProps} onImport={onImport} />)
    await waitFor(() => expect(container.querySelectorAll('.audiobook-clip')).toHaveLength(2))
    fireEvent.click(screen.getByRole('slider', { name: 'Wiedergabeposition auf der Zeitleiste' }), { clientX: 1400 })
    const blocks = container.querySelectorAll<HTMLElement>('.audiobook-clip')
    expect(blocks[0].style.width).toBe('1200px')
    expect(blocks[1].style.width).toBe('600px')
    expect(blocks[1].style.left).toBe('400px')
    fireEvent.click(screen.getByRole('button', { name: 'Freier Bereich in Spur 2' }), { clientX: 1500, clientY: 20, detail: 1 })
    const input = screen.getByLabelText('Importieren')
    expect(input).not.toHaveAttribute('accept')
    const file = new File(['a'], 'neu.m4a', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onImport).toHaveBeenCalledWith('two', 32.5, { b: 15 }, file)

    const viewport = screen.getByRole('region', { name: 'Gemeinsame Zeitleiste' })
    viewport.scrollLeft = 200
    fireEvent.scroll(viewport)
    fireEvent.click(screen.getByRole('button', { name: 'Freier Bereich in Spur 2' }))
    fireEvent.change(screen.getByLabelText('Importieren'), { target: { files: [file] } })
    expect(onImport).toHaveBeenLastCalledWith('two', 0, { b: 15 }, file)
  })
})
