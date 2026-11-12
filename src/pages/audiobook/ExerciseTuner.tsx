import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { TooltipMenu, TooltipMenuButton } from '../../components/TooltipMenu'
import { PitchChart } from '../../features/tuner/components/PitchChart'
import { TunerSettingsPanel } from '../../features/tuner/components/TunerSettingsPanel'
import { CHART_LEFT, CHART_PLOT_WIDTH, CHART_WIDTH } from '../../features/tuner/chartGeometry'
import { appendPoint } from '../../features/tuner/history'
import { useLiveTuner } from '../../features/tuner/hooks/useLiveTuner'
import { describePitch, frequencyToMidi, type PitchPoint } from '../../features/tuner/pitch'
import { readTunerSettings, TUNER_SETTINGS_STORAGE_KEY, type TunerSettings } from '../../features/tuner/settings'
import { getTrackClips, getTrackType, type AudioClip, type AudioTrack } from './audioStorage'
import { createVocalDebugTrace, downloadVocalDebugTrace, type TracePoint } from './debugTrace'
import type { ReferencePitchJob, ReferencePitchPoint } from './referencePitch'
import { useSmoothPitchView } from './useSmoothPitchView'
import { formatSeconds, getTickInterval } from './waveform'
import '../tuner/tunerPage.css'

type Decoded = Record<string, { buffer?: AudioBuffer, error?: boolean }>
type Analysis = { points?: ReferencePitchPoint[], error?: string }
type Result = { id: string, points?: ReferencePitchPoint[], error?: string }

function makeJob(clip: AudioClip, buffer: AudioBuffer, octaveSkipFrames: number): ReferencePitchJob {
  const from = Math.max(0, Math.round((clip.sourceStart ?? 0) * buffer.sampleRate))
  const duration = clip.duration ?? buffer.duration - (clip.sourceStart ?? 0)
  const end = Math.min(buffer.length, from + Math.round(duration * buffer.sampleRate))
  if (!Number.isFinite(duration) || duration <= 0 || from >= end || buffer.numberOfChannels < 1) {
    throw new Error('Ungültiger Audiobereich')
  }
  const samples = new Float32Array(end - from)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) samples[i] += data[from + i] / buffer.numberOfChannels
  }
  return { id: clip.id, samples, sampleRate: buffer.sampleRate, start: clip.start, octaveSkipFrames }
}

export function ExerciseTuner({ tracks, decoded, position, duration, playing, seekVersion, controlsTarget, settingsTarget = null, onSeek, traceMenuTarget = null, onTraceDownload }: {
  tracks: AudioTrack[]
  decoded: Decoded
  position: number
  duration: number
  playing: boolean
  seekVersion: number
  controlsTarget: HTMLElement | null
  settingsTarget?: HTMLElement | null
  onSeek: (time: number) => void
  traceMenuTarget?: HTMLElement | null
  onTraceDownload?: () => void
}) {
  const [stored] = useState(readTunerSettings)
  const [settings, setSettings] = useState(stored.settings)
  const [settingsError, setSettingsError] = useState(stored.error)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [vocalMenuOpen, setVocalMenuOpen] = useState(false)
  const [referenceEnabled, setReferenceEnabled] = useState(true)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const vocalButtonRef = useRef<HTMLButtonElement>(null)
  const vocalMenuRef = useRef<HTMLDivElement>(null)
  const chartDrag = useRef<{ pointerId: number, x: number, position: number, width: number, last: number } | null>(null)
  const [draggingChart, setDraggingChart] = useState(false)
  const tuner = useLiveTuner(settings)
  const [selectedId, setSelectedId] = useState('')
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({})
  const [workerError, setWorkerError] = useState('')
  const [traceError, setTraceError] = useState('')
  const [livePoints, setLivePoints] = useState<PitchPoint[]>([])
  const workerRef = useRef<Worker | null>(null)
  const queued = useRef(new Set<string>())
  const pending = useRef<{ clip: AudioClip, buffer: AudioBuffer }[]>([])
  const active = useRef(false)
  const pump = useRef<() => void>(() => {})
  const lastSample = useRef<PitchPoint | undefined>(undefined)
  const latestSample = useRef<PitchPoint | undefined>(undefined)
  latestSample.current = tuner.points.at(-1)
  const wasPlaying = useRef(false)
  const vocalTracks = tracks.filter((track) => getTrackType(track) === 'vocal')
  const hasVocalTracks = vocalTracks.length > 0
  const selected = vocalTracks.find((track) => track.id === selectedId) ?? vocalTracks[0]

  useEffect(() => {
    if (vocalMenuOpen) vocalMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [vocalMenuOpen])

  const updateSettings = (next: TunerSettings) => {
    setSettings(next)
    try {
      localStorage.setItem(TUNER_SETTINGS_STORAGE_KEY, JSON.stringify(next))
      setSettingsError(null)
    } catch (error) {
      console.error('Tuner-Einstellungen konnten nicht gespeichert werden:', error)
      setSettingsError('Einstellungen konnten nicht gespeichert werden und gelten nur bis zum Verlassen der Seite.')
    }
  }

  useEffect(() => {
    if (!hasVocalTracks) return
    setAnalysis({})
    setWorkerError('')
    const queuedIds = queued.current
    let disposed = false
    let worker: Worker
    try {
      worker = new Worker(new URL('./referencePitch.worker.ts', import.meta.url), { type: 'module' })
    } catch (error) {
      console.error('Tonhöhenanalyse konnte nicht gestartet werden:', error)
      setWorkerError('Die Tonhöhenanalyse konnte nicht gestartet werden.')
      return
    }
    workerRef.current = worker
    pump.current = () => {
      if (active.current || pending.current.length === 0) return
      const task = pending.current.shift()
      if (!task) return
      try {
        const job = makeJob(task.clip, task.buffer, settings.octaveSkipFrames)
        active.current = true
        worker.postMessage(job, [job.samples.buffer])
      } catch (error) {
        console.error('Tonhöhenanalyse konnte nicht vorbereitet werden:', error)
        setAnalysis((current) => ({ ...current, [task.clip.id]: { error: 'Audiodaten konnten nicht analysiert werden.' } }))
        active.current = false
        pump.current()
      }
    }
    worker.onmessage = (event: MessageEvent<Result>) => {
      if (disposed) return
      const result = event.data
      if (result.error || !result.points) console.error('Tonhöhenanalyse fehlgeschlagen:', result.error)
      setAnalysis((current) => ({ ...current, [result.id]: result.points ? { points: result.points } : { error: 'Audiodaten konnten nicht analysiert werden.' } }))
      active.current = false
      pump.current()
    }
    worker.onerror = (event) => {
      if (disposed) return
      console.error('Tonhöhenanalyse fehlgeschlagen:', event.message)
      setWorkerError('Die Tonhöhenanalyse ist fehlgeschlagen. Bitte öffne die Übungsansicht erneut.')
      worker.terminate()
      workerRef.current = null
      pending.current = []
      active.current = false
    }
    worker.onmessageerror = () => {
      if (disposed) return
      console.error('Ergebnis der Tonhöhenanalyse konnte nicht gelesen werden.')
      setWorkerError('Das Ergebnis der Tonhöhenanalyse konnte nicht gelesen werden. Bitte öffne die Übungsansicht erneut.')
      worker.terminate()
      workerRef.current = null
      pending.current = []
      active.current = false
    }
    return () => {
      disposed = true
      worker.terminate()
      workerRef.current = null
      pending.current = []
      queuedIds.clear()
      active.current = false
    }
  }, [hasVocalTracks, settings.octaveSkipFrames])

  useEffect(() => {
    if (!workerRef.current) return
    for (const track of tracks) {
      if (getTrackType(track) !== 'vocal') continue
      for (const clip of getTrackClips(track)) {
        const buffer = decoded[clip.id]?.buffer
        if (buffer && !queued.current.has(clip.id)) {
          queued.current.add(clip.id)
          pending.current.push({ clip, buffer })
        }
      }
    }
    pump.current()
  }, [tracks, decoded, settings.octaveSkipFrames])

  useEffect(() => {
    setLivePoints([])
    lastSample.current = latestSample.current
  }, [seekVersion])

  useEffect(() => {
    const latest = tuner.points.at(-1)
    if (playing && !wasPlaying.current) {
      setLivePoints((current) => current.length ? [...current, { timeMs: position * 1000, frequency: null }] : current)
    }
    wasPlaying.current = playing
    if (!playing || tuner.status !== 'listening') {
      lastSample.current = latest
      return
    }
    if (!latest || latest === lastSample.current) return
    lastSample.current = latest
    setLivePoints((current) => {
      const timeMs = position * 1000
      return appendPoint(current.at(-1) && timeMs < current[current.length - 1].timeMs ? [] : current, { timeMs, frequency: latest.frequency }, settings)
    })
  }, [tuner.points, tuner.status, position, playing, settings])

  const clips = useMemo(() => selected ? [...getTrackClips(selected)].sort((a, b) => a.start - b.start) : [], [selected])
  const reference = useMemo<TracePoint[]>(() => clips.flatMap((clip) => {
    const points = analysis[clip.id]?.points ?? []
    return points.length ? [
      ...points.map((point): TracePoint => ({ ...point, clipId: clip.id, kind: 'sample' })),
      { timeMs: clip.start * 1000 + (clip.duration ?? (decoded[clip.id]?.buffer?.duration ?? 0) - (clip.sourceStart ?? 0)) * 1000, frequency: null, rawFrequency: null, clipId: clip.id, kind: 'clip-end' as const },
    ] : []
  }), [clips, analysis, decoded])
  const windowMs = settings.windowMs
  const centerMs = position * 1000
  const startMs = centerMs - windowMs / 2
  const endMs = centerMs + windowMs / 2
  const tickInterval = getTickInterval(200 / (windowMs / 1000))
  const firstTick = Math.max(0, Math.ceil(startMs / 1000 / tickInterval))
  const lastTick = Math.floor(Math.min(duration, endMs / 1000) / tickInterval)
  const ticks = Array.from({ length: Math.max(0, lastTick - firstTick + 1) }, (_, index) => (firstTick + index) * tickInterval)
  let low = 0
  let high = reference.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (reference[mid].timeMs < startMs - 100) low = mid + 1
    else high = mid
  }
  const visibleReference: PitchPoint[] = []
  for (let i = low; i < reference.length && reference[i].timeMs <= endMs + 100; i++) visibleReference.push(reference[i])
  const visibleLive = livePoints.filter((point) => point.timeMs >= startMs - 100 && point.timeMs <= endMs + 100)
  const displayedReference = referenceEnabled ? visibleReference : []
  const nearest = displayedReference.filter((point) => point.frequency !== null).reduce<PitchPoint | undefined>((best, point) =>
    !best || Math.abs(point.timeMs - centerMs) < Math.abs(best.timeMs - centerMs) ? point : best, undefined)
  const frequency = tuner.status === 'listening' ? tuner.points.at(-1)?.frequency ?? null : null
  const centerFrequency = tuner.status === 'listening'
    ? tuner.points.findLast((point) => point.frequency !== null)?.frequency ?? null
    : null
  const referenceMidi = nearest?.frequency ? frequencyToMidi(nearest.frequency) : null
  const liveMidi = centerFrequency ? frequencyToMidi(centerFrequency) : null
  const lowMidi = referenceMidi !== null && liveMidi !== null ? Math.min(referenceMidi, liveMidi) : referenceMidi ?? liveMidi
  const highMidi = referenceMidi !== null && liveMidi !== null ? Math.max(referenceMidi, liveMidi) : referenceMidi ?? liveMidi
  const { center, span } = useSmoothPitchView(lowMidi, highMidi, draggingChart)
  const reading = frequency ? describePitch(frequency) : null
  const selectedError = clips.some((clip) => decoded[clip.id]?.error || analysis[clip.id]?.error)
  const loading = clips.some((clip) => !decoded[clip.id]?.error && !analysis[clip.id])
  const seekWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    let next: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = position - 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = position + 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = duration
    else return
    event.preventDefault()
    next = Math.max(0, Math.min(duration, next))
    if (next !== position) onSeek(next)
  }

  return (
    <section className="exercise-tuner" aria-label="Stimmgerät zum Üben">
      {!vocalTracks.length && <p>Füge im Editmodus eine Vocalspur hinzu, um eine Referenz anzuzeigen.</p>}
      {selected && clips.length === 0 && <p>Diese Vocalspur enthält noch keine Audioblöcke.</p>}
      {loading && !workerError && <p role="status">Tonhöhen der Vocalspur werden analysiert …</p>}
      {(workerError || selectedError) && <p className="tuner-error" role="alert">{workerError || 'Mindestens ein Audioblock konnte nicht analysiert werden.'}</p>}
      {traceError && <p className="tuner-error" role="alert">{traceError}</p>}
      {settingsError && !settingsOpen && <p className="tuner-error" role="alert">{settingsError}</p>}
      {tuner.error && <p className="tuner-error" role="alert">{tuner.error}</p>}
      <div className="tuner-reading" aria-label="Aktuelle Tonhöhe">
        <strong>{reading?.note ?? '–'}</strong>
        <span>{reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents} ct` : '– ct'}</span>
        <span>{frequency === null ? '– Hz' : `${frequency.toFixed(1)} Hz`}</span>
      </div>
      <div className="exercise-tuner-ruler-shell">
        <div
          className="exercise-tuner-ruler"
          role="slider"
          tabIndex={0}
          aria-label="Wiedergabeposition auf der Übungszeitleiste"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.min(duration, Math.max(0, position))}
          aria-valuetext={`${position.toFixed(1)} Sekunden`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const plotWidth = rect.width * CHART_PLOT_WIDTH / CHART_WIDTH
            if (plotWidth <= 0) return
            const x = event.clientX - rect.left - rect.width * CHART_LEFT / CHART_WIDTH
            const next = Math.max(0, Math.min(duration, (startMs + x / plotWidth * windowMs) / 1000))
            if (next !== position) onSeek(next)
          }}
          onKeyDown={seekWithKeyboard}
        >
          {ticks.map((seconds) => {
            const left = (CHART_LEFT + (seconds * 1000 - startMs) / windowMs * CHART_PLOT_WIDTH) / CHART_WIDTH * 100
            return <span className={`exercise-tuner-tick${left > 85 ? ' is-right' : ''}`} key={seconds} style={{ left: `${left}%` }}>{formatSeconds(seconds, tickInterval)}</span>
          })}
          <span className="exercise-tuner-ruler-playhead" aria-hidden="true" />
        </div>
      </div>
      <div
        className="exercise-tuner-chart"
        role="slider"
        tabIndex={0}
        aria-label="Wiedergabeposition im Stimmgerät"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.min(duration, Math.max(0, position))}
        aria-valuetext={`${position.toFixed(1)} Sekunden`}
        aria-describedby="exercise-tuner-seek-hint"
        onKeyDown={seekWithKeyboard}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary || chartDrag.current || duration <= 0) return
          const width = event.currentTarget.getBoundingClientRect().width * CHART_PLOT_WIDTH / CHART_WIDTH
          if (width <= 0) return
          chartDrag.current = { pointerId: event.pointerId, x: event.clientX, position, width, last: position }
          setDraggingChart(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = chartDrag.current
          if (!drag || drag.pointerId !== event.pointerId) return
          const next = Math.max(0, Math.min(duration, drag.position - (event.clientX - drag.x) / drag.width * windowMs / 1000))
          if (next !== drag.last) {
            drag.last = next
            onSeek(next)
          }
        }}
        onPointerUp={(event) => {
          if (chartDrag.current?.pointerId !== event.pointerId) return
          chartDrag.current = null
          setDraggingChart(false)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={(event) => {
          if (chartDrag.current?.pointerId === event.pointerId) {
            chartDrag.current = null
            setDraggingChart(false)
          }
        }}
        onLostPointerCapture={(event) => {
          if (chartDrag.current?.pointerId === event.pointerId) {
            chartDrag.current = null
            setDraggingChart(false)
          }
        }}
      >
        <PitchChart points={visibleLive} referencePoints={displayedReference} startMs={startMs} endMs={endMs} center={center} span={span} timeTicksMs={ticks.map((seconds) => seconds * 1000)} showPlayhead />
      </div>
      {controlsTarget && createPortal(
        <>
          <button type="button" className="audiobook-secondary" onClick={tuner.status === 'listening' || tuner.status === 'starting' ? tuner.stop : () => void tuner.start()}>
            {tuner.status === 'starting' ? 'Mikrofonstart abbrechen' : tuner.status === 'listening' ? 'Mikrofon stoppen' : 'Mikrofon starten'}
          </button>
          <div className="exercise-vocal-menu-anchor" onKeyDown={(event) => {
            if (event.key === 'Escape' && vocalMenuOpen) {
              event.stopPropagation()
              setVocalMenuOpen(false)
              vocalButtonRef.current?.focus()
            }
          }}>
            <button ref={vocalButtonRef} type="button" className={`audiobook-secondary exercise-vocal-button${referenceEnabled && selected ? ' is-active' : ''}`}
              aria-label="Vocalspur auswählen" aria-haspopup="menu" aria-expanded={vocalMenuOpen}
              title={referenceEnabled && selected ? 'Vocal-Referenz aktiv' : 'Vocal-Referenz aus'}
              onPointerDown={(event) => event.stopPropagation()} onClick={() => setVocalMenuOpen((open) => !open)}>V</button>
            {vocalMenuOpen && <TooltipMenu className="exercise-vocal-menu" onClose={() => setVocalMenuOpen(false)}>
              <div ref={vocalMenuRef} role="menu" aria-label="Vocal-Referenz" onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
                const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
                if (!items.length) return
                event.preventDefault()
                const current = items.findIndex((item) => item === document.activeElement)
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                  : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                items[index].focus()
              }}>
                <TooltipMenuButton role="menuitemradio" aria-checked={!referenceEnabled || !selected} onClick={() => { setReferenceEnabled(false); setVocalMenuOpen(false); vocalButtonRef.current?.focus() }}>Keine Referenz</TooltipMenuButton>
                {vocalTracks.map((track) => <TooltipMenuButton key={track.id} role="menuitemradio" aria-checked={referenceEnabled && selected?.id === track.id}
                  onClick={() => { setSelectedId(track.id); setReferenceEnabled(true); setVocalMenuOpen(false); vocalButtonRef.current?.focus() }}>
                  Spur {tracks.indexOf(track) + 1}{track.name ? `: ${track.name}` : ''}
                </TooltipMenuButton>)}
              </div>
            </TooltipMenu>}
          </div>
        </>,
        controlsTarget,
      )}
      {settingsTarget && createPortal(
        <button ref={settingsButtonRef} type="button" className="audiobook-secondary exercise-settings-button"
          aria-label="Stimmgerät-Einstellungen" title="Stimmgerät-Einstellungen" aria-haspopup="dialog" aria-expanded={settingsOpen}
          onClick={() => { setVocalMenuOpen(false); setSettingsOpen(true) }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>,
        settingsTarget,
      )}
      <div className="exercise-tuner-actions">
        <span><span className="exercise-reference-key">Referenz</span> · <span className="exercise-live-key">Mikrofon</span></span>
      </div>
      {traceMenuTarget && createPortal(
        <TooltipMenuButton
          disabled={!selected || !clips.length || loading || !!workerError || selectedError || !reference.length}
          title={!selected || !clips.length ? 'Keine Vocalspur mit Audioblöcken ausgewählt.' : loading ? 'Die Analyse der Vocalspur läuft noch.' : workerError || selectedError ? 'Die Vocalspur konnte nicht vollständig analysiert werden.' : undefined}
          onClick={() => {
            if (!selected) return
            try {
              const trace = createVocalDebugTrace(selected, tracks.indexOf(selected) + 1, settings.octaveSkipFrames, reference)
              downloadVocalDebugTrace(trace)
              setTraceError('')
              onTraceDownload?.()
            } catch (error) {
              console.error('Debug-Trace konnte nicht heruntergeladen werden:', error)
              setTraceError('Der Debug-Trace konnte nicht heruntergeladen werden.')
              onTraceDownload?.()
            }
          }}
        >Debug-Trace herunterladen</TooltipMenuButton>,
        traceMenuTarget,
      )}
      {settingsOpen && <TunerSettingsPanel settings={settings} storageError={settingsError} onChange={updateSettings} onClose={() => {
        setSettingsOpen(false)
        settingsButtonRef.current?.focus()
      }} />}
    </section>
  )
}
