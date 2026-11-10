import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { getTrackMix, type AudioTrack, type TrackMix } from './audioStorage'
import { decodeWaveform, formatSeconds, getTickInterval, type WaveformData } from './waveform'
import { useSongTransport } from './useSongTransport'

const MIN_ZOOM = 5
const MAX_ZOOM = 200
const INITIAL_ZOOM = 40
const WAVE_HEIGHT = 96

type TimelineTrack = {
  waveform?: WaveformData
  buffer?: AudioBuffer
  error?: boolean
}

function TrackDecoder({ track, onDecoded }: {
  track: AudioTrack
  onDecoded: (id: string, result: TimelineTrack) => void
}) {
  useEffect(() => {
    let active = true
    void decodeWaveform(track.audio).then(({ waveform, buffer }) => {
      if (active) onDecoded(track.id, { waveform, buffer })
    }).catch(() => {
      if (active) onDecoded(track.id, { error: true })
    })
    return () => { active = false }
  }, [track.id, track.audio, onDecoded])
  return null
}

function TrackControls({ track, index, onMixChange }: {
  track: AudioTrack
  index: number
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
}) {
  const [volumeOpen, setVolumeOpen] = useState(false)
  const { volume, muted } = getTrackMix(track)
  const name = `Spur ${index + 1}: ${track.name}`

  return (
    <div className="audiobook-track-controls" role="group" aria-label={`Einstellungen für ${name}`}>
      <div className="audiobook-track-buttons">
        <button
          type="button"
          className="audiobook-track-button"
          aria-label={`Lautstärke für ${name}`}
          aria-expanded={volumeOpen}
          onClick={() => setVolumeOpen((open) => !open)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9v6h4l5 4V5L7 9H3z" />
            <path d="M16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12" />
          </svg>
        </button>
        <button
          type="button"
          className={`audiobook-track-button audiobook-mute ${muted ? 'is-muted' : ''}`}
          aria-label={`${name} stummschalten`}
          aria-pressed={muted}
          onClick={() => onMixChange(track.id, { muted: !muted })}
        >M</button>
      </div>
      {volumeOpen && (
        <label className="audiobook-volume">
          <span>{Math.round(volume * 100)} %</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            aria-label={`Lautstärke ${name}`}
            onChange={(event) => onMixChange(track.id, { volume: Number(event.target.value) / 100 })}
          />
        </label>
      )}
    </div>
  )
}

function Waveform({ data, width, offset, zoom }: {
  data: WaveformData
  width: number
  offset: number
  zoom: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.ceil(width * ratio)
    canvas.height = Math.ceil(WAVE_HEIGHT * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.fillStyle = '#283da9'
    const columns = Math.ceil(width / 2)
    for (let column = 0; column < columns; column++) {
      const start = (offset + column * 2) / zoom
      if (start >= data.duration) break
      const end = (offset + (column + 1) * 2) / zoom
      const first = Math.max(0, Math.floor(start * data.peaksPerSecond))
      const last = Math.min(data.peaks.length, Math.ceil(end * data.peaksPerSecond))
      let peak = 0
      for (let i = first; i < last; i++) peak = Math.max(peak, data.peaks[i])
      const height = Math.max(1, Math.min(1, peak) * (WAVE_HEIGHT - 8))
      context.fillRect(column * 2, (WAVE_HEIGHT - height) / 2, 1, height)
    }
  }, [data, width, offset, zoom])

  return <canvas ref={canvasRef} className="audiobook-waveform" style={{ width, height: WAVE_HEIGHT }} aria-hidden="true" />
}

export function AudioTimeline({ tracks, onMixChange }: {
  tracks: AudioTrack[]
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
}) {
  const [decoded, setDecoded] = useState<Record<string, TimelineTrack>>({})
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [viewport, setViewport] = useState({ width: 0, offset: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef<{ time: number, anchor: number } | null>(null)
  const hasTracks = tracks.length > 0

  const onDecoded = useCallback((id: string, result: TimelineTrack) => {
    setDecoded((current) => ({ ...current, [id]: result }))
  }, [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const update = () => setViewport({ width: node.clientWidth, offset: node.scrollLeft })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasTracks])

  const changeZoom = useCallback((factor: number, anchor: number) => {
    const node = viewportRef.current
    if (!node) return
    setZoom((current) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor))
      if (next !== current) pendingScroll.current = { time: (node.scrollLeft + anchor) / current, anchor }
      return next
    })
  }, [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      const anchor = Math.max(0, Math.min(node.clientWidth, event.clientX - node.getBoundingClientRect().left))
      changeZoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.005), anchor)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [changeZoom, hasTracks])

  useLayoutEffect(() => {
    const node = viewportRef.current
    const pending = pendingScroll.current
    if (!node || !pending) return
    node.scrollLeft = pending.time * zoom - pending.anchor
    pendingScroll.current = null
    setViewport({ width: node.clientWidth, offset: node.scrollLeft })
  }, [zoom])

  const duration = Math.max(0, ...tracks.map((track) => decoded[track.id]?.waveform?.duration ?? 0))
  const buffers = tracks.flatMap((track) => {
    const buffer = decoded[track.id]?.buffer
    return buffer ? [{ id: track.id, buffer, ...getTrackMix(track) }] : []
  })
  const ready = tracks.length > 0 && buffers.length === tracks.length && duration > 0
  const transport = useSongTransport(buffers, duration, ready, tracks.map((track) => track.id).join(','))
  const interval = getTickInterval(zoom)
  const firstTick = Math.max(0, Math.ceil(viewport.offset / zoom / interval))
  const lastTick = Math.floor(Math.min(duration, (viewport.offset + viewport.width) / zoom) / interval)
  const ticks = Array.from({ length: Math.max(0, lastTick - firstTick + 1) }, (_, index) => {
    const seconds = (firstTick + index) * interval
    return { seconds, x: seconds * zoom - viewport.offset }
  })

  return (
    <>
      {tracks.map((track) => <TrackDecoder key={track.id} track={track} onDecoded={onDecoded} />)}
      {hasTracks && <div className="audiobook-timeline-section">
      <div className="audiobook-timeline-toolbar">
        <div>
          <strong>Zeitleiste</strong>
          <p>Mit dem Mausrad zoomen, horizontal scrollen zum Verschieben.</p>
        </div>
        <div className="audiobook-zoom-controls" aria-label="Zoom der Zeitleiste">
          <button type="button" className="audiobook-secondary" aria-label="Herauszoomen" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(1 / 1.5, viewport.width / 2)}>−</button>
          <button type="button" className="audiobook-secondary" aria-label="Hineinzoomen" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(1.5, viewport.width / 2)}>+</button>
        </div>
      </div>
      <div className="audiobook-timeline-grid">
      <div className="audiobook-mixer">
        <div className="audiobook-mixer-ruler" />
        {tracks.map((track, index) => (
          <TrackControls key={track.id} track={track} index={index} onMixChange={onMixChange} />
        ))}
      </div>
      <div
        className="audiobook-timeline-viewport"
        ref={viewportRef}
        onScroll={(event) => setViewport({ width: event.currentTarget.clientWidth, offset: event.currentTarget.scrollLeft })}
        role="region"
        aria-label="Gemeinsame Zeitleiste"
        tabIndex={0}
      >
        <div className="audiobook-timeline-inner" style={{ width: Math.max(viewport.width, duration * zoom + 1) }}>
          <div className="audiobook-ruler" style={{ width: viewport.width }} aria-label="Zeitachse in Sekunden">
            {ticks.map(({ seconds, x }) => (
              <span className="audiobook-tick" key={seconds} style={{ left: x }}>{formatSeconds(seconds, interval)}</span>
            ))}
            <span className="audiobook-playhead" style={{ left: transport.position * zoom - viewport.offset }} />
          </div>
          {tracks.map((track, index) => {
            const entry = decoded[track.id]
            return (
              <div className={`audiobook-wave-row ${getTrackMix(track).muted ? 'is-muted' : ''}`} key={track.id}>
                <div className="audiobook-wave-visible" style={{ width: viewport.width }}>
                  <span className="audiobook-wave-name">Spur {index + 1}: {track.name}</span>
                  {entry?.waveform ? (
                    <div
                      className="audiobook-wave-seek"
                      role="slider"
                      tabIndex={0}
                      aria-label={`Wiedergabeposition in Spur ${index + 1}`}
                      aria-valuemin={0}
                      aria-valuemax={duration}
                      aria-valuenow={Number(transport.position.toFixed(2))}
                      aria-valuetext={`${transport.position.toFixed(1)} Sekunden`}
                      onClick={(event) => {
                        const x = event.clientX - event.currentTarget.getBoundingClientRect().left
                        transport.seek((viewport.offset + x) / zoom)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                          event.preventDefault()
                          transport.seek(transport.position + (event.key === 'ArrowLeft' ? -1 : 1))
                        } else if (event.key === 'Home' || event.key === 'End') {
                          event.preventDefault()
                          transport.seek(event.key === 'Home' ? 0 : duration)
                        }
                      }}
                    >
                      <Waveform data={entry.waveform} width={viewport.width} offset={viewport.offset} zoom={zoom} />
                      <span className="audiobook-playhead" style={{ left: transport.position * zoom - viewport.offset }} />
                    </div>
                  ) :
                    <p className="audiobook-wave-status" role={entry?.error ? 'alert' : 'status'}>
                      {entry?.error ? 'Audiodatei konnte nicht geladen werden. Das Lied kann nicht abgespielt werden.' : 'Wellenform wird geladen ...'}
                    </p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>}
      <div className="audiobook-transport" aria-label="Wiedergabesteuerung">
        {transport.error && <p className="audiobook-transport-error" role="alert">{transport.error}</p>}
        <div className="audiobook-transport-buttons">
          {
           transport.playing && <button type="button" className="audiobook-secondary" aria-label="Pause" disabled={!transport.playing && !transport.starting} onClick={transport.pause}>❚❚</button>
          }
          {
            !transport.playing && <button type="button" className="audiobook-primary" aria-label="Abspielen" disabled={!ready || transport.playing || transport.starting} onClick={() => void transport.play()}>▶</button>
          }
          
        </div>
        <span className="audiobook-transport-time" aria-label="Aktuelle Wiedergabeposition">{transport.position.toFixed(1)} / {duration.toFixed(1)} s</span>
      </div>
    </>
  )
}
