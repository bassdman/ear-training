import { useEffect, useMemo, useRef, useState } from 'react'

import { PitchChart } from '../../features/tuner/components/PitchChart'
import { appendPoint } from '../../features/tuner/history'
import { useLiveTuner } from '../../features/tuner/hooks/useLiveTuner'
import { describePitch, frequencyToMidi, type PitchPoint } from '../../features/tuner/pitch'
import { readTunerSettings } from '../../features/tuner/settings'
import { getTrackClips, getTrackType, type AudioClip, type AudioTrack } from './audioStorage'
import type { ReferencePitchJob } from './referencePitch'
import '../tuner/tunerPage.css'

type Decoded = Record<string, { buffer?: AudioBuffer, error?: boolean }>
type Analysis = { points?: PitchPoint[], error?: string }
type Result = { id: string, points?: PitchPoint[], error?: string }

function makeJob(clip: AudioClip, buffer: AudioBuffer): ReferencePitchJob {
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
  return { id: clip.id, samples, sampleRate: buffer.sampleRate, start: clip.start }
}

export function ExerciseTuner({ tracks, decoded, position, playing, seekVersion }: {
  tracks: AudioTrack[]
  decoded: Decoded
  position: number
  playing: boolean
  seekVersion: number
}) {
  const [settings] = useState(readTunerSettings)
  const tuner = useLiveTuner(settings.settings)
  const [selectedId, setSelectedId] = useState('')
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({})
  const [workerError, setWorkerError] = useState('')
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
    if (!hasVocalTracks) return
    const queuedIds = queued.current
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
        const job = makeJob(task.clip, task.buffer)
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
      const result = event.data
      if (result.error || !result.points) console.error('Tonhöhenanalyse fehlgeschlagen:', result.error)
      setAnalysis((current) => ({ ...current, [result.id]: result.points ? { points: result.points } : { error: 'Audiodaten konnten nicht analysiert werden.' } }))
      active.current = false
      pump.current()
    }
    worker.onerror = (event) => {
      console.error('Tonhöhenanalyse fehlgeschlagen:', event.message)
      setWorkerError('Die Tonhöhenanalyse ist fehlgeschlagen. Bitte öffne die Übungsansicht erneut.')
      worker.terminate()
      workerRef.current = null
      pending.current = []
      active.current = false
    }
    worker.onmessageerror = () => {
      console.error('Ergebnis der Tonhöhenanalyse konnte nicht gelesen werden.')
      setWorkerError('Das Ergebnis der Tonhöhenanalyse konnte nicht gelesen werden. Bitte öffne die Übungsansicht erneut.')
      worker.terminate()
      workerRef.current = null
      pending.current = []
      active.current = false
    }
    return () => {
      worker.terminate()
      workerRef.current = null
      pending.current = []
      queuedIds.clear()
      active.current = false
    }
  }, [hasVocalTracks])

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
  }, [tracks, decoded])

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
      return appendPoint(current.at(-1) && timeMs < current[current.length - 1].timeMs ? [] : current, { timeMs, frequency: latest.frequency }, settings.settings)
    })
  }, [tuner.points, tuner.status, position, playing, settings.settings])

  const clips = useMemo(() => selected ? [...getTrackClips(selected)].sort((a, b) => a.start - b.start) : [], [selected])
  const reference = useMemo(() => clips.flatMap((clip) => {
    const points = analysis[clip.id]?.points ?? []
    return points.length ? [...points, { timeMs: clip.start * 1000 + (clip.duration ?? (decoded[clip.id]?.buffer?.duration ?? 0) - (clip.sourceStart ?? 0)) * 1000, frequency: null }] : []
  }), [clips, analysis, decoded])
  const windowMs = settings.settings.windowMs
  const centerMs = position * 1000
  const startMs = centerMs - windowMs / 2
  const endMs = centerMs + windowMs / 2
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
  const nearest = visibleReference.filter((point) => point.frequency !== null).reduce<PitchPoint | undefined>((best, point) =>
    !best || Math.abs(point.timeMs - centerMs) < Math.abs(best.timeMs - centerMs) ? point : best, undefined)
  const frequency = tuner.status === 'listening' ? tuner.points.at(-1)?.frequency ?? null : null
  const referenceMidi = nearest?.frequency ? frequencyToMidi(nearest.frequency) : null
  const liveMidi = frequency ? frequencyToMidi(frequency) : null
  const center = referenceMidi !== null && liveMidi !== null
    ? (referenceMidi + liveMidi) / 2
    : referenceMidi ?? liveMidi ?? 60
  const span = referenceMidi !== null && liveMidi !== null ? Math.max(24, Math.abs(referenceMidi - liveMidi) + 4) : 24
  const reading = frequency ? describePitch(frequency) : null
  const selectedError = clips.some((clip) => decoded[clip.id]?.error || analysis[clip.id]?.error)
  const loading = clips.some((clip) => !decoded[clip.id]?.error && !analysis[clip.id])

  return (
    <section className="exercise-tuner" aria-label="Stimmgerät zum Üben">
      <div className="exercise-tuner-header">
        <h2>Stimmgerät</h2>
        <label>Vocalspur
          <select value={selected?.id ?? ''} disabled={!vocalTracks.length} onChange={(event) => setSelectedId(event.target.value)}>
            {!vocalTracks.length && <option value="">Keine Vocalspur</option>}
            {vocalTracks.map((track) => <option key={track.id} value={track.id}>Spur {tracks.indexOf(track) + 1}{track.name ? `: ${track.name}` : ''}</option>)}
          </select>
        </label>
      </div>
      {!vocalTracks.length && <p>Füge im Editmodus eine Vocalspur hinzu, um eine Referenz anzuzeigen.</p>}
      {selected && clips.length === 0 && <p>Diese Vocalspur enthält noch keine Audioblöcke.</p>}
      {loading && !workerError && <p role="status">Tonhöhen der Vocalspur werden analysiert …</p>}
      {(workerError || selectedError) && <p className="tuner-error" role="alert">{workerError || 'Mindestens ein Audioblock konnte nicht analysiert werden.'}</p>}
      {settings.error && <p className="tuner-error" role="alert">{settings.error}</p>}
      {tuner.error && <p className="tuner-error" role="alert">{tuner.error}</p>}
      <div className="tuner-reading" aria-label="Aktuelle Tonhöhe">
        <strong>{reading?.note ?? '–'}</strong>
        <span>{reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents} ct` : '– ct'}</span>
        <span>{frequency === null ? '– Hz' : `${frequency.toFixed(1)} Hz`}</span>
      </div>
      <div className="exercise-tuner-chart">
        <PitchChart points={visibleLive} referencePoints={visibleReference} startMs={startMs} endMs={endMs} center={center} span={span} showPlayhead />
      </div>
      <div className="exercise-tuner-actions">
        <button type="button" className="audiobook-secondary" onClick={tuner.status === 'listening' || tuner.status === 'starting' ? tuner.stop : () => void tuner.start()}>
          {tuner.status === 'starting' ? 'Mikrofonstart abbrechen' : tuner.status === 'listening' ? 'Mikrofon stoppen' : 'Mikrofon starten'}
        </button>
        <span><span className="exercise-reference-key">Referenz</span> · <span className="exercise-live-key">Mikrofon</span></span>
      </div>
    </section>
  )
}
