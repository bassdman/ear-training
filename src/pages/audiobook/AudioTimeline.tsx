import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { TooltipMenu, TooltipMenuButton, TooltipMenuFile, TooltipMenuRange } from '../../components/TooltipMenu'
import { getTrackClips, getTrackMix, getTrackType, type AudioClip, type AudioTrack, type TrackMix, type TrackType } from './audioStorage'
import { decodeWaveform, formatSeconds, getTickInterval, type WaveformData } from './waveform'
import { useSongTransport } from './useSongTransport'
import { createProjectId } from './storage'
import { ExerciseTuner } from './ExerciseTuner'

const MIN_ZOOM = 5
const MAX_ZOOM = 200
const INITIAL_ZOOM = 40
const WAVE_HEIGHT = 96
const DRAG_EDGE_WIDTH = 48
const TRACK_LABELS: Record<TrackType, string> = { vocal: 'Vocal', instrumental: 'Instrumental', mixed: 'Mixed' }

type TimelineTrack = {
  waveform?: WaveformData
  buffer?: AudioBuffer
  error?: boolean
}

function TrackDecoder({ clip, onDecoded, decode }: {
  clip: AudioClip
  onDecoded: (id: string, result: TimelineTrack) => void
  decode: typeof decodeWaveform
}) {
  useEffect(() => {
    let active = true
    void decode(clip.audio).then(({ waveform, buffer }) => {
      if (active) onDecoded(clip.id, { waveform, buffer })
    }).catch(() => {
      if (active) onDecoded(clip.id, { error: true })
    })
    return () => { active = false }
  }, [clip.id, clip.audio, onDecoded, decode])
  return null
}

function TrackControls({ track, index, onMixChange, onDelete, busy }: {
  track: AudioTrack
  index: number
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
  onDelete: (id: string) => void
  busy: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { volume, muted } = getTrackMix(track)
  const name = track.name ? `Spur ${index + 1}: ${track.name}` : `Spur ${index + 1}`

  return (
    <div className={`audiobook-track-controls ${menuOpen ? 'has-menu' : ''}`} role="group" aria-label={`Einstellungen für ${name}`}>
      <span className="audiobook-track-type">{TRACK_LABELS[getTrackType(track)]}</span>
      <div className="audiobook-track-buttons">
        <button
          type="button"
          className={`audiobook-track-button audiobook-mute ${muted ? 'is-muted' : ''}`}
          aria-label={`${name} stummschalten`}
          aria-pressed={muted}
          onClick={() => onMixChange(track.id, { muted: !muted })}
        >M</button>
        <button
          type="button"
          className="audiobook-track-button"
          aria-label={`Optionen für ${name}`}
          aria-expanded={menuOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => { setMenuOpen((open) => !open); setConfirmDelete(false) }}
        >...</button>
      </div>
      {menuOpen && (
        <TooltipMenu
          className="audiobook-track-menu"
          onClose={() => { setMenuOpen(false); setConfirmDelete(false) }}
        >
          {confirmDelete ? (
            <>
              <span>Spur und alle ihre Audioblöcke löschen?</span>
              <div className="audiobook-track-menu-actions">
                <TooltipMenuButton className="audiobook-track-delete" disabled={busy} onClick={() => { onDelete(track.id); setMenuOpen(false); setConfirmDelete(false) }}>Endgültig löschen</TooltipMenuButton>
                <TooltipMenuButton disabled={busy} onClick={() => setConfirmDelete(false)}>Abbrechen</TooltipMenuButton>
              </div>
            </>
          ) : (
            <>
              <TooltipMenuRange
                label={`Lautstärke: ${Math.round(volume * 100)} %`}
                className="audiobook-volume"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                aria-label={`Lautstärke ${name}`}
                onChange={(event) => onMixChange(track.id, { volume: Number(event.currentTarget.value) / 100 })}
              />
              <TooltipMenuButton className="audiobook-track-delete" disabled={busy} onClick={() => setConfirmDelete(true)}>Spur löschen</TooltipMenuButton>
            </>
          )}
        </TooltipMenu>
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

export function AudioTimeline({ tracks, onMixChange, onImport, onPaste, onMove, onSplit, onDelete, onDeleteTrack, busy, readOnly = false }: {
  tracks: AudioTrack[]
  readOnly?: boolean
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
  onImport: (trackId: string, start: number, durations: Record<string, number>, file: File) => void
  onPaste: (trackId: string, start: number, durations: Record<string, number>, clip: AudioClip) => void
  onMove: (sourceId: string, targetId: string, clipId: string, start: number, durations: Record<string, number>) => void
  onSplit: (trackId: string, clipId: string, at: number, duration: number) => void
  onDelete: (trackId: string, clipId: string) => void
  onDeleteTrack: (trackId: string) => void
  busy: boolean
}) {
  const [decoded, setDecoded] = useState<Record<string, TimelineTrack>>({})
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [viewport, setViewport] = useState({ width: 0, offset: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ trackId: string, time: number, y: number } | null>(null)
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [clipMenu, setClipMenu] = useState<{ trackId: string, clipId: string, time: number } | null>(null)
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [drag, setDrag] = useState<{ sourceId: string, clipId: string, targetId: string, start: number, duration: number } | null>(null)
  const [pendingExtent, setPendingExtent] = useState(0)
  const [seekVersion, setSeekVersion] = useState(0)
  const dragRef = useRef<{ pointerId: number, sourceId: string, clipId: string, startX: number, x: number, initialStart: number, initialScroll: number, duration: number, moved: boolean, targetId?: string, direction: number, scroll: number, lastFrame?: number } | null>(null)
  const previewRef = useRef<typeof drag>(null)
  const dragFrame = useRef<number | null>(null)
  const decodedAudio = useRef(new WeakMap<Blob, ReturnType<typeof decodeWaveform>>())
  const hasTracks = tracks.length > 0

  const onDecoded = useCallback((id: string, result: TimelineTrack) => {
    setDecoded((current) => ({ ...current, [id]: result }))
  }, [])
  useEffect(() => {
    const active = new Set(tracks.flatMap((track) => getTrackClips(track).map((clip) => clip.id)))
    setDecoded((current) => {
      const entries = Object.entries(current).filter(([id]) => active.has(id))
      return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries)
    })
  }, [tracks])
  const decode = useCallback((audio: Blob) => {
    const cached = decodedAudio.current.get(audio)
    if (cached) return cached
    const result = decodeWaveform(audio).catch((cause: unknown) => {
      decodedAudio.current.delete(audio)
      throw cause
    })
    decodedAudio.current.set(audio, result)
    return result
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

  const changeZoom = useCallback((factor: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor)))
  }, [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      changeZoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.005))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [changeZoom, hasTracks])

  const allClips = tracks.flatMap((track) => getTrackClips(track).map((clip) => ({ track, clip })))
  const duration = Math.max(0, ...allClips.map(({ clip }) => clip.start + (clip.duration ?? decoded[clip.id]?.waveform?.duration ?? 0)))
  const scrollDuration = Math.max(duration, pendingExtent, drag ? drag.start + drag.duration + viewport.width / zoom : 0)
  const buffers = allClips.flatMap(({ track, clip }) => {
    const buffer = decoded[clip.id]?.buffer
    return buffer ? [{ id: clip.id, trackId: track.id, start: clip.start, sourceStart: clip.sourceStart, duration: clip.duration, buffer, ...getTrackMix(track) }] : []
  })
  const ready = allClips.length > 0 && buffers.length === allClips.length && duration > 0
  const transport = useSongTransport(buffers, scrollDuration, ready, JSON.stringify(allClips.map(({ clip, track }) => [clip.id, track.id, clip.start])))
  const { position, seek } = transport
  const dragEnvironment = useRef({ zoom, seek })
  dragEnvironment.current = { zoom, seek }
  useLayoutEffect(() => {
    const node = viewportRef.current
    if (!node) return
    if (position > scrollDuration) {
      seek(scrollDuration)
      return
    }
    node.scrollLeft = position * zoom
    setViewport((current) => current.width === node.clientWidth && current.offset === node.scrollLeft
      ? current
      : { width: node.clientWidth, offset: node.scrollLeft })
  }, [position, seek, zoom, viewport.width, scrollDuration, hasTracks])

  useEffect(() => () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
  }, [])

  useEffect(() => {
    setMenu(null)
    setClipMenu(null)
    setSelectedClip(null)
    setConfirmDelete(false)
    const node = viewportRef.current
    const pointerId = dragRef.current?.pointerId
    if (node && pointerId !== undefined && node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId)
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    dragRef.current = null
    previewRef.current = null
    setDrag(null)
  }, [readOnly])

  useEffect(() => {
    if (!busy) setPendingExtent(0)
  }, [busy, pendingExtent])

  const updateDragPreview = (scroll: number) => {
    const current = dragRef.current
    if (!current) return
    const preview = current.targetId ? {
      sourceId: current.sourceId,
      clipId: current.clipId,
      targetId: current.targetId,
      start: Math.max(0, current.initialStart + (current.x - current.startX + scroll - current.initialScroll) / dragEnvironment.current.zoom),
      duration: current.duration,
    } : null
    previewRef.current = preview
    setDrag(preview)
  }

  const autoScroll = (time: number) => {
    dragFrame.current = null
    const current = dragRef.current
    const node = viewportRef.current
    if (!current || !node || !current.direction || !current.targetId) return
    if (current.lastFrame !== undefined) {
      const { zoom: currentZoom, seek: currentSeek } = dragEnvironment.current
      current.scroll = Math.max(0, current.scroll + current.direction * node.clientWidth * 0.5 * (time - current.lastFrame) / 1000)
      updateDragPreview(current.scroll)
      currentSeek(current.scroll / currentZoom)
    }
    current.lastFrame = time
    dragFrame.current = requestAnimationFrame(autoScroll)
  }

  const stopDrag = () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    dragRef.current = null
    previewRef.current = null
    setDrag(null)
  }

  const viewStart = viewport.offset - viewport.width / 2
  const durations = Object.fromEntries(allClips.flatMap(({ clip }) => {
    const value = clip.duration ?? decoded[clip.id]?.waveform?.duration
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
  const activateClip = (trackId: string, clipId: string, time: number) => {
    setMenu(null)
    setConfirmDelete(false)
    if (selectedClip === clipId) {
      setClipMenu({ trackId, clipId, time })
    } else {
      setSelectedClip(clipId)
      setClipMenu(null)
    }
  }
  const interval = getTickInterval(zoom)
  const firstTick = Math.max(0, Math.ceil(viewStart / zoom / interval))
  const lastTick = Math.floor((viewStart + viewport.width) / zoom / interval)
  const ticks = Array.from({ length: Math.max(0, lastTick - firstTick + 1) }, (_, index) => {
    const seconds = (firstTick + index) * interval
    return { seconds, x: seconds * zoom - viewStart }
  })

  return (
    <>
      {allClips.map(({ clip }) => <TrackDecoder key={clip.id} clip={clip} onDecoded={onDecoded} decode={decode} />)}
      {readOnly && <ExerciseTuner tracks={tracks} decoded={decoded} position={transport.position} playing={transport.playing} seekVersion={seekVersion} />}
      {hasTracks && <div className="audiobook-timeline-section">
      <div className="audiobook-timeline-toolbar">
        <div>
          <strong>Zeitleiste</strong>
          <p>Mit dem Mausrad zoomen, horizontal scrollen zum Ändern der Wiedergabeposition.</p>
        </div>
        <div className="audiobook-zoom-controls" aria-label="Zoom der Zeitleiste">
          <button type="button" className="audiobook-secondary" aria-label="Herauszoomen" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(1 / 1.5)}>−</button>
          <button type="button" className="audiobook-secondary" aria-label="Hineinzoomen" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(1.5)}>+</button>
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
          aria-valuemax={scrollDuration}
          aria-valuenow={Number(transport.position.toFixed(2))}
          aria-valuetext={`${transport.position.toFixed(1)} Sekunden`}
          onClick={(event) => {
            const x = event.clientX - event.currentTarget.getBoundingClientRect().left
            setSeekVersion((current) => current + 1)
            transport.seek((viewStart + x) / zoom)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              setSeekVersion((current) => current + 1)
              transport.seek(transport.position + (event.key === 'ArrowLeft' ? -1 : 1))
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              setSeekVersion((current) => current + 1)
              transport.seek(event.key === 'Home' ? 0 : duration)
            }
          }}
        >
          {ticks.map(({ seconds, x }) => (
            <span className="audiobook-tick" key={seconds} style={{ left: x }}>{formatSeconds(seconds, interval)}</span>
          ))}
          <span className="audiobook-playhead" style={{ left: '50%' }} aria-hidden="true" />
        </div>
      </div>
      <div className="audiobook-timeline-grid">
      <div className="audiobook-mixer">
        {tracks.map((track, index) => (
          readOnly
            ? <div key={track.id} className="audiobook-track-controls" role="group" aria-label={`Spur ${index + 1}: ${TRACK_LABELS[getTrackType(track)]}`}><span className="audiobook-track-type">{TRACK_LABELS[getTrackType(track)]}</span></div>
            : <TrackControls key={track.id} track={track} index={index} onMixChange={onMixChange} busy={busy} onDelete={(id) => { transport.pause(); onDeleteTrack(id) }} />
        ))}
      </div>
      <div
        className="audiobook-timeline-viewport"
        ref={viewportRef}
        onScroll={(event) => {
          const node = event.currentTarget
          setViewport({ width: node.clientWidth, offset: node.scrollLeft })
          if (Math.abs(node.scrollLeft - transport.position * zoom) > 0.5) {
            setSeekVersion((current) => current + 1)
            transport.seek(node.scrollLeft / zoom)
          }
        }}
        onPointerMove={(event) => {
          const current = dragRef.current
          const node = viewportRef.current
          if (!current || !node || current.pointerId !== event.pointerId) return
          const rect = node.getBoundingClientRect()
          current.x = Math.max(rect.left, Math.min(rect.right - 1, event.clientX))
          current.targetId = document.elementFromPoint(current.x, event.clientY)?.closest<HTMLElement>('.audiobook-wave-seek')?.dataset.trackId
          const delta = current.x - current.startX
          if (!current.moved && (Math.abs(delta) >= 4 || (current.targetId && current.targetId !== current.sourceId))) {
            current.moved = true
            setClipMenu(null)
            if (transport.playing || transport.starting) transport.pause()
          }
          if (!current.moved) return
          const edge = Math.min(DRAG_EDGE_WIDTH, rect.width / 4)
          const direction = current.targetId ? (current.x < rect.left + edge ? -1 : current.x >= rect.right - edge ? 1 : 0) : 0
          if (current.direction !== direction) {
            current.direction = direction
            current.lastFrame = undefined
            current.scroll = node.scrollLeft
          }
          updateDragPreview(node.scrollLeft)
          if (direction && dragFrame.current === null) dragFrame.current = requestAnimationFrame(autoScroll)
          if (!direction && dragFrame.current !== null) {
            cancelAnimationFrame(dragFrame.current)
            dragFrame.current = null
          }
        }}
        onPointerUp={(event) => {
          const current = dragRef.current
          if (!current || current.pointerId !== event.pointerId) return
          const preview = previewRef.current
          if (current.moved && preview) {
            setPendingExtent(preview.start + preview.duration + viewport.width / zoom)
            submitMove(preview.sourceId, preview.targetId, preview.clipId, preview.start)
          } else if (!current.moved) {
            const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.audiobook-wave-seek')
            const rect = row?.getBoundingClientRect()
            if (rect && row?.dataset.trackId === current.sourceId) activateClip(current.sourceId, current.clipId, (viewStart + event.clientX - rect.left) / zoom)
          }
          stopDrag()
        }}
        onPointerCancel={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) stopDrag()
        }}
        onLostPointerCapture={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) stopDrag()
        }}
        role="region"
        aria-label="Gemeinsame Zeitleiste"
        tabIndex={0}
      >
        <div className="audiobook-timeline-inner" style={{ width: viewport.width + scrollDuration * zoom }}>
          <span className="audiobook-playhead audiobook-track-playhead" style={{ left: viewport.offset + viewport.width / 2 }} aria-hidden="true" />
          {tracks.map((track, index) => {
            const clips = getTrackClips(track)
            return (
              <div className={`audiobook-wave-row ${getTrackMix(track).muted ? 'is-muted' : ''}`} data-track-type={getTrackType(track)} key={track.id}>
                <div className="audiobook-wave-visible" style={{ width: viewport.width }}>
                    <div
                      className={`audiobook-wave-seek ${readOnly ? 'is-read-only' : ''}`}
                      data-track-id={track.id}
                    >
                      {!readOnly && <button
                        type="button"
                        className="audiobook-empty-area"
                        aria-label={`Freier Bereich in Spur ${index + 1}`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          const x = event.detail === 0 ? 0 : event.clientX - rect.left
                          const y = event.detail === 0 ? 0 : Math.max(0, event.clientY - rect.top)
                          setSelectedClip(null)
                          setClipMenu(null)
                          setMenu({ trackId: track.id, time: Math.max(0, (viewStart + x) / zoom), y })
                        }}
                      />}
                      {clips.map((clip) => {
                        const clipData = decoded[clip.id]
                        const clipDuration = clip.duration ?? clipData?.waveform?.duration ?? 0
                        const left = clip.start * zoom - viewStart
                        const right = left + clipDuration * zoom
                        const visibleLeft = Math.max(0, left)
                        const visibleRight = Math.min(viewport.width, right)
                        if (clipData?.error) return <p className="audiobook-wave-status" role="alert" key={clip.id}>Audiodatei „{clip.name}“ konnte nicht geladen werden.</p>
                        if (!clipData?.waveform) return <p className="audiobook-wave-status" role="status" key={clip.id}>Wellenform wird geladen ...</p>
                        if (visibleRight <= visibleLeft) return null
                        return (
                          <div
                            key={clip.id}
                            className={`audiobook-clip ${readOnly ? 'is-read-only' : ''} ${selectedClip === clip.id && !readOnly ? 'is-selected' : ''}`}
                            style={{ left: visibleLeft, width: visibleRight - visibleLeft }}
                            role={readOnly ? 'img' : 'button'}
                            tabIndex={readOnly ? undefined : 0}
                            aria-label={readOnly ? `Audioblock ${clip.name} in Spur ${index + 1}` : `Audioblock ${clip.name} in Spur ${index + 1} verschieben`}
                            aria-description={readOnly ? undefined : 'Mit Pfeiltasten zeitlich oder zwischen Spuren verschieben.'}
                            aria-pressed={readOnly ? undefined : selectedClip === clip.id}
                            onPointerDown={(event) => {
                              if (readOnly || busy || (event.pointerType === 'mouse' && event.button !== 0)) return
                              event.stopPropagation()
                              setMenu(null)
                              const node = viewportRef.current
                              if (!node) return
                              node.setPointerCapture(event.pointerId)
                              dragRef.current = { pointerId: event.pointerId, sourceId: track.id, clipId: clip.id, startX: event.clientX, x: event.clientX, initialStart: clip.start, initialScroll: node.scrollLeft, scroll: node.scrollLeft, duration: clipDuration, moved: false, direction: 0 }
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (!readOnly && event.detail === 0) activateClip(track.id, clip.id, clip.start)
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                              if (readOnly || busy) return
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                activateClip(track.id, clip.id, clip.start)
                              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
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
                            <Waveform data={clipData.waveform} width={visibleRight - visibleLeft} offset={(visibleLeft - left) + (clip.sourceStart ?? 0) * zoom} zoom={zoom} />
                          </div>
                        )
                      })}
                      {drag?.targetId === track.id && (
                        <div className="audiobook-clip-preview" style={{ left: drag.start * zoom - viewStart, width: drag.duration * zoom }} aria-hidden="true" />
                      )}
                      {!readOnly && clipMenu?.trackId === track.id && (() => {
                        const clip = clips.find((item) => item.id === clipMenu.clipId)
                        const length = clip && durations[clip.id]
                        const canSplit = clip && length && position > clip.start && position < clip.start + length
                        return (
                          <TooltipMenu
                            className="audiobook-import-menu audiobook-clip-menu"
                            style={{ left: Math.max(0, Math.min(clipMenu.time * zoom - viewStart, viewport.width - 230)), top: 0, maxWidth: viewport.width }}
                            onClose={() => { setClipMenu(null); setConfirmDelete(false) }}
                          >
                            {confirmDelete ? (
                              <>
                                <span className="audiobook-menu-hint">Audioblock wirklich löschen?</span>
                                <TooltipMenuButton disabled={busy} onClick={() => {
                                  transport.pause()
                                  onDelete(track.id, clipMenu.clipId)
                                  setConfirmDelete(false)
                                  setClipMenu(null)
                                  setSelectedClip(null)
                                }}>Endgültig löschen</TooltipMenuButton>
                                <TooltipMenuButton disabled={busy} onClick={() => setConfirmDelete(false)}>Abbrechen</TooltipMenuButton>
                              </>
                            ) : (
                              <>
                                {canSplit ? (
                                  <TooltipMenuButton disabled={busy} onClick={() => {
                                  transport.pause()
                                  onSplit(track.id, clip.id, position, length)
                                  setClipMenu(null)
                                  setSelectedClip(null)
                                  }}>Schneiden</TooltipMenuButton>
                                ) : <></>}
                                <TooltipMenuButton disabled={busy || !clip || !length} onClick={() => {
                                  if (!clip || !length) return
                                  setCopiedClip({ ...clip, duration: length, audioId: clip.audioId ?? createProjectId() })
                                  setClipMenu(null)
                                }}>Kopieren</TooltipMenuButton>
                                <TooltipMenuButton disabled={busy} onClick={() => setConfirmDelete(true)}>Löschen</TooltipMenuButton>
                              </>
                            )}
                          </TooltipMenu>
                        )
                      })()}
                      {!readOnly && menu?.trackId === track.id && (
                        <TooltipMenu
                          className="audiobook-import-menu"
                          style={{ left: Math.max(0, Math.min(menu.time * zoom - viewStart, viewport.width - 150)), top: Math.min(menu.y, 52), maxWidth: viewport.width }}
                          onClose={() => setMenu(null)}
                        >
                          <TooltipMenuFile label="Importieren" disabled={busy || clips.some((clip) => !decoded[clip.id]?.waveform)} onChange={(file) => {
                            const durations = Object.fromEntries(clips.map((clip) => [clip.id, clip.duration ?? decoded[clip.id]?.waveform?.duration ?? 0]))
                            onImport(track.id, menu.time, durations, file)
                            setMenu(null)
                          }} />
                          {copiedClip && <TooltipMenuButton disabled={busy || clips.some((clip) => !durations[clip.id])} onClick={() => {
                            transport.pause()
                            onPaste(track.id, menu.time, durations, copiedClip)
                            setMenu(null)
                          }}>Einfügen</TooltipMenuButton>}
                        </TooltipMenu>
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
