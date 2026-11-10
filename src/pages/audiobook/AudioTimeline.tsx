import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { getTrackClips, getTrackMix, type AudioClip, type AudioTrack, type TrackMix } from './audioStorage'
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

function TrackDecoder({ clip, onDecoded }: {
  clip: AudioClip
  onDecoded: (id: string, result: TimelineTrack) => void
}) {
  useEffect(() => {
    let active = true
    void decodeWaveform(clip.audio).then(({ waveform, buffer }) => {
      if (active) onDecoded(clip.id, { waveform, buffer })
    }).catch(() => {
      if (active) onDecoded(clip.id, { error: true })
    })
    return () => { active = false }
  }, [clip.id, clip.audio, onDecoded])
  return null
}

function TrackControls({ track, index, onMixChange }: {
  track: AudioTrack
  index: number
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
}) {
  const [volumeOpen, setVolumeOpen] = useState(false)
  const { volume, muted } = getTrackMix(track)
  const name = track.name ? `Spur ${index + 1}: ${track.name}` : `Spur ${index + 1}`

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

export function AudioTimeline({ tracks, onMixChange, onImport, onMove, busy }: {
  tracks: AudioTrack[]
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
  onImport: (trackId: string, start: number, durations: Record<string, number>, file: File) => void
  onMove: (sourceId: string, targetId: string, clipId: string, start: number, durations: Record<string, number>) => void
  busy: boolean
}) {
  const [decoded, setDecoded] = useState<Record<string, TimelineTrack>>({})
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [viewport, setViewport] = useState({ width: 0, offset: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef<{ time: number, anchor: number } | null>(null)
  const [menu, setMenu] = useState<{ trackId: string, time: number, x: number, y: number } | null>(null)
  const [drag, setDrag] = useState<{ sourceId: string, clipId: string, targetId: string, start: number, duration: number } | null>(null)
  const dragRef = useRef<{ pointerId: number, sourceId: string, clipId: string, startX: number, initialStart: number, initialScroll: number, duration: number, moved: boolean } | null>(null)
  const previewRef = useRef<typeof drag>(null)
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

  const allClips = tracks.flatMap((track) => getTrackClips(track).map((clip) => ({ track, clip })))
  const duration = Math.max(0, ...allClips.map(({ clip }) => clip.start + (decoded[clip.id]?.waveform?.duration ?? clip.duration ?? 0)))
  const timelineDuration = Math.max(30, duration + 10)
  const buffers = allClips.flatMap(({ track, clip }) => {
    const buffer = decoded[clip.id]?.buffer
    return buffer ? [{ id: clip.id, trackId: track.id, start: clip.start, buffer, ...getTrackMix(track) }] : []
  })
  const ready = allClips.length > 0 && buffers.length === allClips.length && duration > 0
  const transport = useSongTransport(buffers, duration, ready, JSON.stringify(allClips.map(({ clip, track }) => [clip.id, track.id, clip.start])))
  const durations = Object.fromEntries(allClips.flatMap(({ clip }) => {
    const value = decoded[clip.id]?.waveform?.duration ?? clip.duration
    return value === undefined ? [] : [[clip.id, value]]
  }))
  const submitMove = (sourceId: string, targetId: string, clipId: string, start: number) => {
    const source = tracks.find((track) => track.id === sourceId)
    const target = tracks.find((track) => track.id === targetId)
    const clip = source && getTrackClips(source).find((item) => item.id === clipId)
    const length = durations[clipId]
    if (!clip || !target || !length) return
    if (sourceId === targetId && Math.abs(clip.start - start) < 0.001) return
    onMove(sourceId, targetId, clipId, Math.max(0, start), durations)
  }
  const interval = getTickInterval(zoom)
  const firstTick = Math.max(0, Math.ceil(viewport.offset / zoom / interval))
  const lastTick = Math.floor(Math.min(timelineDuration, (viewport.offset + viewport.width) / zoom) / interval)
  const ticks = Array.from({ length: Math.max(0, lastTick - firstTick + 1) }, (_, index) => {
    const seconds = (firstTick + index) * interval
    return { seconds, x: seconds * zoom - viewport.offset }
  })

  return (
    <>
      {allClips.map(({ clip }) => <TrackDecoder key={clip.id} clip={clip} onDecoded={onDecoded} />)}
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
      <div className="audiobook-sticky-ruler">
        <div className="audiobook-ruler-spacer" />
        <div
          className="audiobook-ruler"
          role="slider"
          tabIndex={0}
          aria-label="Wiedergabeposition auf der Zeitleiste"
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
          {ticks.map(({ seconds, x }) => (
            <span className="audiobook-tick" key={seconds} style={{ left: x }}>{formatSeconds(seconds, interval)}</span>
          ))}
          <span className="audiobook-playhead" style={{ left: transport.position * zoom - viewport.offset }} aria-hidden="true" />
        </div>
      </div>
      <div className="audiobook-timeline-grid">
      <div className="audiobook-mixer">
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
        <div className="audiobook-timeline-inner" style={{ width: Math.max(viewport.width, timelineDuration * zoom + 1) }}>
          <span className="audiobook-playhead audiobook-track-playhead" style={{ left: transport.position * zoom }} aria-hidden="true" />
          {tracks.map((track, index) => {
            const clips = getTrackClips(track)
            return (
              <div className={`audiobook-wave-row ${getTrackMix(track).muted ? 'is-muted' : ''}`} key={track.id}>
                <div className="audiobook-wave-visible" style={{ width: viewport.width }}>
                    <div
                      className="audiobook-wave-seek"
                      data-track-id={track.id}
                    >
                      <button
                        type="button"
                        className="audiobook-empty-area"
                        aria-label={`Freier Bereich in Spur ${index + 1}`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          const x = event.detail === 0 ? 0 : event.clientX - rect.left
                          const y = event.detail === 0 ? 0 : Math.max(0, event.clientY - rect.top)
                          setMenu({ trackId: track.id, time: Math.max(0, (viewport.offset + x) / zoom), x, y })
                        }}
                      />
                      {clips.map((clip) => {
                        const clipData = decoded[clip.id]
                        const clipDuration = clipData?.waveform?.duration ?? clip.duration ?? 0
                        const left = clip.start * zoom - viewport.offset
                        const right = left + clipDuration * zoom
                        const visibleLeft = Math.max(0, left)
                        const visibleRight = Math.min(viewport.width, right)
                        if (clipData?.error) return <p className="audiobook-wave-status" role="alert" key={clip.id}>Audiodatei „{clip.name}“ konnte nicht geladen werden.</p>
                        if (!clipData?.waveform) return <p className="audiobook-wave-status" role="status" key={clip.id}>Wellenform wird geladen ...</p>
                        if (visibleRight <= visibleLeft) return null
                        return (
                          <div
                            key={clip.id}
                            className="audiobook-clip"
                            style={{ left: visibleLeft, width: visibleRight - visibleLeft }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Audioblock ${clip.name} in Spur ${index + 1} verschieben`}
                            aria-description="Mit Pfeiltasten zeitlich oder zwischen Spuren verschieben."
                            onPointerDown={(event) => {
                              if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return
                              event.stopPropagation()
                              setMenu(null)
                              event.currentTarget.setPointerCapture(event.pointerId)
                              dragRef.current = { pointerId: event.pointerId, sourceId: track.id, clipId: clip.id, startX: event.clientX, initialStart: clip.start, initialScroll: viewportRef.current?.scrollLeft ?? 0, duration: clipDuration, moved: false }
                            }}
                            onPointerMove={(event) => {
                              const current = dragRef.current
                              if (!current || current.pointerId !== event.pointerId) return
                              const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.audiobook-wave-seek')
                              const targetId = target?.dataset.trackId
                              const delta = event.clientX - current.startX
                              if (Math.abs(delta) >= 4 || (targetId && targetId !== current.sourceId)) current.moved = true
                              if (!current.moved) return
                              const scroll = viewportRef.current?.scrollLeft ?? 0
                              const preview = targetId ? { sourceId: current.sourceId, clipId: current.clipId, targetId, start: Math.max(0, current.initialStart + (delta + scroll - current.initialScroll) / zoom), duration: current.duration } : null
                              previewRef.current = preview
                              setDrag(preview)
                            }}
                            onPointerUp={(event) => {
                              event.stopPropagation()
                              const current = dragRef.current
                              const preview = previewRef.current
                              if (current?.pointerId === event.pointerId && current.moved && preview) {
                                submitMove(preview.sourceId, preview.targetId, preview.clipId, preview.start)
                              }
                              dragRef.current = null
                              previewRef.current = null
                              setDrag(null)
                            }}
                            onPointerCancel={() => {
                              dragRef.current = null
                              previewRef.current = null
                              setDrag(null)
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                              if (busy) return
                              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                event.preventDefault()
                                submitMove(track.id, track.id, clip.id, Math.max(0, clip.start + (event.key === 'ArrowLeft' ? -1 : 1)))
                              } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                event.preventDefault()
                                const target = tracks[index + (event.key === 'ArrowUp' ? -1 : 1)]
                                if (target) submitMove(track.id, target.id, clip.id, clip.start)
                              }
                            }}
                          >
                            <span className="audiobook-clip-name">{clip.name}</span>
                            <Waveform data={clipData.waveform} width={visibleRight - visibleLeft} offset={(visibleLeft - left)} zoom={zoom} />
                          </div>
                        )
                      })}
                      {drag?.targetId === track.id && (
                        <div className="audiobook-clip-preview" style={{ left: drag.start * zoom - viewport.offset, width: drag.duration * zoom }} aria-hidden="true" />
                      )}
                      {menu?.trackId === track.id && (
                        <div className="audiobook-import-menu" style={{ left: Math.min(menu.x, Math.max(0, viewport.width - 130)), top: Math.min(menu.y, 52) }} onClick={(event) => event.stopPropagation()}>
                          <label>
                            Importieren
                            <input type="file" disabled={busy || clips.some((clip) => !decoded[clip.id]?.waveform)} onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ''
                              if (file) {
                                const durations = Object.fromEntries(clips.map((clip) => [clip.id, decoded[clip.id]?.waveform?.duration ?? 0]))
                                onImport(track.id, menu.time, durations, file)
                                setMenu(null)
                              }
                            }} />
                          </label>
                          <button type="button" aria-label="Importmenü schließen" onClick={() => setMenu(null)}>×</button>
                        </div>
                      )}
                    </div>
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
