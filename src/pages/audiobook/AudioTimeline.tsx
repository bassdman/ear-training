import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { TooltipMenu, TooltipMenuButton, TooltipMenuFile, TooltipMenuRange } from '../../components/TooltipMenu'
import { getTrackClips, getTrackMix, getTrackType, type AudioClip, type AudioTrack, type TrackMix, type TrackType } from './audioStorage'
import { decodeWaveform, formatSeconds, getTickInterval, type WaveformData } from './waveform'
import { useSongTransport } from './useSongTransport'
import { createProjectId } from './storage'
import { ExerciseTuner } from './ExerciseTuner'
import { useTrackRecording } from '../../features/recording/useTrackRecording'
import type { PlaybackDiagnostics } from './playbackDiagnostics'

const MIN_ZOOM = 5
const MAX_ZOOM = 200
const INITIAL_ZOOM = 40
const WAVE_HEIGHT = 96
const WAVE_CACHE_MARGIN = 128
const DRAG_EDGE_WIDTH = 48
const TIMELINE_FRAMES_PER_SECOND = 25
const TRACK_LABELS: Record<TrackType, string> = { vocal: 'Vocal', instrumental: 'Instrumental', mixed: 'Mixed' }

function formatTimecode(time: number): string {
  const totalFrames = Math.floor(time * TIMELINE_FRAMES_PER_SECOND + 1e-8)
  const frames = totalFrames % TIMELINE_FRAMES_PER_SECOND
  const seconds = Math.floor(totalFrames / TIMELINE_FRAMES_PER_SECOND)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

const POSITION_STEPS = [
  { label: '1min', seconds: 60, name: 'eine Minute' },
  { label: '5s', seconds: 5, name: 'fünf Sekunden' },
  { label: '1s', seconds: 1, name: 'eine Sekunde' },
  { label: '10', seconds: 10 / TIMELINE_FRAMES_PER_SECOND, name: 'zehn Frames' },
  { label: '1', seconds: 1 / TIMELINE_FRAMES_PER_SECOND, name: 'ein Frame' },
]

type TimelineTrack = {
  waveform?: WaveformData
  buffer?: AudioBuffer
  error?: boolean
}

function TrackControls({ track, index, onMixChange, onDelete, onDuplicate, onSeparate, busy, selected, onSelect }: {
  track: AudioTrack
  index: number
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onSeparate: (id: string) => void
  busy: boolean
  selected: boolean
  onSelect: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSeparate, setConfirmSeparate] = useState(false)
  const { volume, muted } = getTrackMix(track)
  const name = track.name ? `Spur ${index + 1}: ${track.name}` : `Spur ${index + 1}`

  return (
    <div className={`audiobook-track-controls ${menuOpen ? 'has-menu' : ''}`} role="group" aria-label={`Einstellungen für ${name}`}>
      <button type="button" className="audiobook-track-select" aria-label={`${name} für Aufnahme auswählen`} aria-pressed={selected} disabled={busy} onClick={onSelect}>
        {selected ? '✓ ' : ''}{TRACK_LABELS[getTrackType(track)]}
      </button>
      <div className="audiobook-track-buttons">
        <button
          type="button"
          className={`audiobook-track-button audiobook-mute ${muted ? 'is-muted' : ''}`}
          aria-label={`${name} stummschalten`}
          aria-pressed={muted}
          disabled={busy}
          onClick={() => onMixChange(track.id, { muted: !muted })}
        >M</button>
        <button
          type="button"
          className="audiobook-track-button"
          aria-label={`Optionen für ${name}`}
          aria-expanded={menuOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => { setMenuOpen((open) => !open); setConfirmDelete(false); setConfirmSeparate(false) }}
        >...</button>
      </div>
      {menuOpen && (
        <TooltipMenu
          className="audiobook-track-menu"
          onClose={() => { setMenuOpen(false); setConfirmDelete(false); setConfirmSeparate(false) }}
        >
          {confirmDelete ? (
            <>
              <span>Spur und alle ihre Audioblöcke löschen?</span>
              <div className="audiobook-track-menu-actions">
                <TooltipMenuButton className="audiobook-track-delete" disabled={busy} onClick={() => { onDelete(track.id); setMenuOpen(false); setConfirmDelete(false) }}>Endgültig löschen</TooltipMenuButton>
                <TooltipMenuButton disabled={busy} onClick={() => setConfirmDelete(false)}>Abbrechen</TooltipMenuButton>
              </div>
            </>
          ) : confirmSeparate ? (
            <>
              <span>Leise Pausen werden entfernt und die Spur geschnitten. Die Erkennung ist ungenau und kann nicht rückgängig gemacht werden. Bei Bedarf vorher die Spur duplizieren.</span>
              <div className="audiobook-track-menu-actions">
                <TooltipMenuButton disabled={busy} onClick={() => { onSeparate(track.id); setMenuOpen(false); setConfirmSeparate(false) }}>Jetzt separieren</TooltipMenuButton>
                <TooltipMenuButton disabled={busy} onClick={() => setConfirmSeparate(false)}>Abbrechen</TooltipMenuButton>
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
                disabled={busy}
                aria-label={`Lautstärke ${name}`}
                onChange={(event) => onMixChange(track.id, { volume: Number(event.currentTarget.value) / 100 })}
              />
              <TooltipMenuButton disabled={busy} onClick={() => { onDuplicate(track.id); setMenuOpen(false) }}>Spur duplizieren</TooltipMenuButton>
              {getTrackType(track) === 'vocal' && <TooltipMenuButton disabled={busy || getTrackClips(track).length === 0} onClick={() => setConfirmSeparate(true)}>Wörter separieren</TooltipMenuButton>}
              <TooltipMenuButton className="audiobook-track-delete" disabled={busy} onClick={() => setConfirmDelete(true)}>Spur löschen</TooltipMenuButton>
            </>
          )}
        </TooltipMenu>
      )}
    </div>
  )
}

function Waveform({ data, width, offset, zoom, diagnostics }: {
  data: WaveformData
  width: number
  offset: number
  zoom: number
  diagnostics?: PlaybackDiagnostics | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cacheRef = useRef<{ canvas: HTMLCanvasElement, data: WaveformData, zoom: number, ratio: number, start: number, width: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return
    const started = diagnostics ? performance.now() : 0
    const ratio = window.devicePixelRatio || 1
    const canvasWidth = Math.ceil(width * ratio)
    const canvasHeight = Math.ceil(WAVE_HEIGHT * ratio)
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight
    const context = canvas.getContext('2d')
    if (!context) {
      diagnostics?.event('waveform-context-error')
      return
    }
    const draw = (target: CanvasRenderingContext2D, startOffset: number, drawWidth: number) => {
      target.fillStyle = '#283da9'
      const columns = Math.ceil(drawWidth / 2)
      for (let column = 0; column < columns; column++) {
        const start = (startOffset + column * 2) / zoom
        if (start >= data.duration) break
        const end = (startOffset + (column + 1) * 2) / zoom
        const first = Math.max(0, Math.floor(start * data.peaksPerSecond))
        const last = Math.min(data.peaks.length, Math.ceil(end * data.peaksPerSecond))
        let peak = 0
        for (let i = first; i < last; i++) peak = Math.max(peak, data.peaks[i])
        const height = Math.max(1, Math.min(1, peak) * (WAVE_HEIGHT - 8))
        target.fillRect(column * 2, (WAVE_HEIGHT - height) / 2, 1, height)
      }
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, WAVE_HEIGHT)
    if (width < 64) {
      diagnostics?.measure('waveformDirectDraws', 1)
      cacheRef.current = null
      draw(context, offset, width)
      diagnostics?.measure('waveformRenderMs', performance.now() - started)
      return
    }
    let cache = cacheRef.current
    if (!cache || cache.data !== data || cache.zoom !== zoom || cache.ratio !== ratio
      || offset < cache.start || offset + width > cache.start + cache.width) {
      const start = Math.max(0, Math.floor(offset / WAVE_CACHE_MARGIN) * WAVE_CACHE_MARGIN)
      const cacheWidth = Math.ceil(width + 2 * WAVE_CACHE_MARGIN)
      const buffer = document.createElement('canvas')
      buffer.width = Math.ceil(cacheWidth * ratio)
      buffer.height = canvasHeight
      const bufferContext = buffer.getContext('2d')
      if (!bufferContext) {
        diagnostics?.event('waveform-cache-context-error')
        cacheRef.current = null
        draw(context, offset, width)
        diagnostics?.measure('waveformRenderMs', performance.now() - started)
        return
      }
      bufferContext.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(bufferContext, start, cacheWidth)
      cache = { canvas: buffer, data, zoom, ratio, start, width: cacheWidth }
      cacheRef.current = cache
      diagnostics?.measure('waveformCacheRebuilds', 1)
    } else {
      diagnostics?.measure('waveformCacheHits', 1)
    }
    context.drawImage(cache.canvas, (offset - cache.start) * ratio, 0, width * ratio, WAVE_HEIGHT * ratio, 0, 0, width, WAVE_HEIGHT)
    diagnostics?.measure('waveformRenderMs', performance.now() - started)
  }, [data, width, offset, zoom, diagnostics])

  return <canvas ref={canvasRef} className="audiobook-waveform" style={{ width, height: WAVE_HEIGHT }} aria-hidden="true" />
}

export function AudioTimeline({ tracks, onMixChange, onImport, onPaste, onMove, onSplit, onDelete, onDeleteTrack, onDuplicateTrack, onSeparateTrack, busy: externalBusy, onRecordSave, onRecordingBusyChange, readOnly = false, traceMenuTarget = null, onTraceDownload, diagnostics }: {
  tracks: AudioTrack[]
  readOnly?: boolean
  traceMenuTarget?: HTMLElement | null
  onTraceDownload?: () => void
  onMixChange: (id: string, patch: Partial<TrackMix>) => void
  onImport: (trackId: string, start: number, durations: Record<string, number>, file: File) => void
  onPaste: (trackId: string, start: number, durations: Record<string, number>, clip: AudioClip) => void
  onMove: (sourceId: string, targetId: string, clipId: string, start: number, durations: Record<string, number>) => void
  onSplit: (trackId: string, clipId: string, at: number, duration: number) => void
  onDelete: (trackId: string, clipId: string) => void
  onDeleteTrack: (trackId: string) => void
  onDuplicateTrack: (trackId: string) => void
  onSeparateTrack: (trackId: string) => void
  busy: boolean
  onRecordSave?: (track: AudioTrack, clip: AudioClip, durations: Record<string, number>) => Promise<void>
  onRecordingBusyChange?: (busy: boolean) => void
  diagnostics?: PlaybackDiagnostics | null
}) {
  const [decoded, setDecoded] = useState<Record<string, TimelineTrack>>({})
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [viewport, setViewport] = useState({ width: 0, offset: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const automaticScrollRef = useRef<{ node: HTMLDivElement, offset: number } | null>(null)
  const [menu, setMenu] = useState<{ trackId: string, time: number, y: number } | null>(null)
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [clipMenu, setClipMenu] = useState<{ trackId: string, clipId: string, time: number } | null>(null)
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [drag, setDrag] = useState<{ sourceId: string, clipId: string, targetId: string, start: number, duration: number } | null>(null)
  const [pendingExtent, setPendingExtent] = useState(0)
  const [seekVersion, setSeekVersion] = useState(0)
  const [microphoneTarget, setMicrophoneTarget] = useState<HTMLDivElement | null>(null)
  const [settingsTarget, setSettingsTarget] = useState<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number, sourceId: string, clipId: string, startX: number, x: number, initialStart: number, initialScroll: number, duration: number, moved: boolean, targetId?: string, direction: number, scroll: number, lastFrame?: number } | null>(null)
  const previewRef = useRef<typeof drag>(null)
  const dragFrame = useRef<number | null>(null)
  const decodedAudio = useRef(new WeakMap<Blob, ReturnType<typeof decodeWaveform>>())
  const recording = useTrackRecording(onRecordSave ?? missingRecordingSave, onRecordingBusyChange)
  const { phase: recordingPhase, stop: stopRecording } = recording
  const busy = externalBusy || recording.phase !== 'idle'
  const hasTracks = tracks.length > 0
  const allClips = useMemo(() => tracks.flatMap((track) => getTrackClips(track).map((clip) => ({ track, clip }))), [tracks])

  useEffect(() => {
    diagnostics?.event('timeline-loaded', {
      mode: readOnly ? 'exercise' : 'edit', tracks: tracks.length, clips: allClips.length,
      uniqueAudio: new Set(allClips.map(({ clip }) => clip.audio)).size,
      audioBytes: [...new Set(allClips.map(({ clip }) => clip.audio))].reduce((total, audio) => total + audio.size, 0),
    })
  }, [diagnostics, readOnly, tracks, allClips])

  useEffect(() => {
    if (readOnly && (recordingPhase === 'preparing' || recordingPhase === 'recording')) stopRecording()
  }, [readOnly, recordingPhase, stopRecording])

  useEffect(() => {
    let active = true
    const groups = new Map<Blob, string[]>()
    const ids = new Set<string>()
    for (const { clip } of allClips) {
      ids.add(clip.id)
      const group = groups.get(clip.audio)
      if (group) group.push(clip.id)
      else groups.set(clip.audio, [clip.id])
    }
    setDecoded((current) => {
      const entries = Object.entries(current).filter(([id]) => ids.has(id))
      return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries)
    })
    for (const [audio, clipIds] of groups) {
      let promise = decodedAudio.current.get(audio)
      if (!promise) {
        const decodeStarted = performance.now()
        diagnostics?.event('decode-start', { bytes: audio.size, mimeType: audio.type, clips: clipIds.length })
        promise = decodeWaveform(audio).catch((cause: unknown) => {
          diagnostics?.event('decode-error', { error: cause instanceof Error ? cause.name : 'unknown', elapsedMs: performance.now() - decodeStarted })
          decodedAudio.current.delete(audio)
          throw cause
        })
        if (diagnostics) void promise.then(({ buffer }) => {
          diagnostics.event('decode-complete', { elapsedMs: performance.now() - decodeStarted, duration: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate })
        }, () => {})
        decodedAudio.current.set(audio, promise)
      }
      const update = (result: TimelineTrack) => {
        if (!active) return
        setDecoded((current) => {
          if (clipIds.every((id) => current[id]?.buffer === result.buffer && current[id]?.waveform === result.waveform && current[id]?.error === result.error)) return current
          const next = { ...current }
          for (const id of clipIds) next[id] = result
          return next
        })
      }
      void promise.then(update, () => update({ error: true }))
    }
    return () => { active = false }
  }, [allClips, diagnostics])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const update = () => setViewport({ width: node.clientWidth, offset: node.scrollLeft })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasTracks, readOnly])

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
  }, [changeZoom, hasTracks, readOnly])

  const duration = useMemo(() => allClips.reduce((end, { clip }) => Math.max(end, clip.start + (clip.duration ?? decoded[clip.id]?.waveform?.duration ?? 0)), 0), [allClips, decoded])
  const scrollDuration = Math.max(duration, pendingExtent, recording.position ?? 0, drag ? drag.start + drag.duration + viewport.width / zoom : 0)
  const buffers = useMemo(() => allClips.flatMap(({ track, clip }) => {
    const buffer = decoded[clip.id]?.buffer
    return buffer ? [{ id: clip.id, trackId: track.id, start: clip.start, sourceStart: clip.sourceStart, duration: clip.duration, buffer, ...getTrackMix(track) }] : []
  }), [allClips, decoded])
  const ready = allClips.length > 0 && buffers.length === allClips.length && duration > 0
  const trackKey = useMemo(() => JSON.stringify(allClips.map(({ clip, track }) => [clip.id, track.id, clip.start])), [allClips])
  const transport = useSongTransport(buffers, scrollDuration, ready, trackKey, diagnostics)
  const { position, seek } = transport
  const displayedPosition = recording.position ?? position
  const dragEnvironment = useRef({ zoom, seek })
  dragEnvironment.current = { zoom, seek }
  useLayoutEffect(() => {
    if (displayedPosition > scrollDuration) {
      seek(scrollDuration)
      return
    }
    const node = viewportRef.current
    if (!node) return
    node.scrollLeft = displayedPosition * zoom
    // Browsers may round or clamp scrollLeft, and deliver its scroll event later.
    automaticScrollRef.current = { node, offset: node.scrollLeft }
    setViewport((current) => current.width === node.clientWidth && current.offset === node.scrollLeft
      ? current
      : { width: node.clientWidth, offset: node.scrollLeft })
  }, [displayedPosition, seek, zoom, viewport.width, scrollDuration, hasTracks, readOnly])

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
  const durations = useMemo(() => Object.fromEntries(allClips.flatMap(({ clip }) => {
    const value = clip.duration ?? decoded[clip.id]?.waveform?.duration
    return value === undefined ? [] : [[clip.id, value]]
  })), [allClips, decoded])
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
      {readOnly && <ExerciseTuner tracks={tracks} decoded={decoded} position={transport.position} duration={duration} playing={transport.playing} seekVersion={seekVersion} controlsTarget={microphoneTarget} settingsTarget={settingsTarget} traceMenuTarget={traceMenuTarget} onTraceDownload={onTraceDownload} onSeek={(time) => {
        setSeekVersion((current) => current + 1)
        transport.seek(time)
      }} />}
      {hasTracks && !readOnly && <div className="audiobook-timeline-section">
      <div className="audiobook-sticky-timeline">
      <div className="audiobook-sticky-ruler">
        <div className="audiobook-ruler-spacer" />
        <div
          className="audiobook-ruler"
          role="slider"
          tabIndex={0}
          aria-label="Wiedergabeposition auf der Zeitleiste"
          aria-valuemin={0}
          aria-valuemax={scrollDuration}
          aria-valuenow={Number(displayedPosition.toFixed(2))}
          aria-valuetext={`${displayedPosition.toFixed(1)} Sekunden`}
          aria-disabled={busy}
          onClick={(event) => {
            if (busy) return
            const x = event.clientX - event.currentTarget.getBoundingClientRect().left
            setSeekVersion((current) => current + 1)
            transport.seek((viewStart + x) / zoom)
          }}
          onKeyDown={(event) => {
            if (busy) return
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
      </div>
      <div className="audiobook-timeline-grid">
      <div className="audiobook-mixer">
        {tracks.map((track, index) => (
          <TrackControls key={track.id} track={track} index={index} onMixChange={onMixChange} busy={busy} selected={selectedTrack === track.id} onSelect={() => setSelectedTrack(track.id)} onDelete={(id) => { transport.pause(); onDeleteTrack(id) }} onDuplicate={(id) => { transport.pause(); onDuplicateTrack(id) }} onSeparate={(id) => { transport.pause(); onSeparateTrack(id) }} />
        ))}
      </div>
      <div
        className="audiobook-timeline-viewport"
        ref={viewportRef}
        onScroll={(event) => {
          const node = event.currentTarget
          diagnostics?.measure('scrollEvents', 1)
          setViewport((current) => current.width === node.clientWidth && current.offset === node.scrollLeft
            ? current
            : { width: node.clientWidth, offset: node.scrollLeft })
          if (recording.phase !== 'idle') return
          const automaticScroll = automaticScrollRef.current
          if (automaticScroll?.node === node && Math.abs(node.scrollLeft - automaticScroll.offset) < 0.5) return
          setSeekVersion((current) => current + 1)
          transport.seek(node.scrollLeft / zoom, 'scroll')
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
            const failedAudio = new Map<Blob, string>()
            let loading = false
            for (const clip of clips) {
              const result = decoded[clip.id]
              if (result?.error) failedAudio.set(clip.audio, clip.name)
              else if (!result?.waveform) loading = true
            }
            return (
              <div className={`audiobook-wave-row ${getTrackMix(track).muted ? 'is-muted' : ''} ${selectedTrack === track.id ? 'is-track-selected' : ''}`} data-track-type={getTrackType(track)} key={track.id}>
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
                          if (busy) return
                          const rect = event.currentTarget.getBoundingClientRect()
                          const x = event.detail === 0 ? 0 : event.clientX - rect.left
                          const y = event.detail === 0 ? 0 : Math.max(0, event.clientY - rect.top)
                          setSelectedClip(null)
                          setClipMenu(null)
                          setMenu({ trackId: track.id, time: Math.max(0, (viewStart + x) / zoom), y })
                        }}
                      />
                      {[...failedAudio.values()].map((name, errorIndex) => <p className="audiobook-wave-status" role="alert" key={errorIndex}>Audiodatei „{name}“ konnte nicht geladen werden.</p>)}
                      {loading && <p className="audiobook-wave-status" role="status">Wellenform wird geladen ...</p>}
                      {clips.map((clip) => {
                        const clipData = decoded[clip.id]
                        const clipDuration = clip.duration ?? clipData?.waveform?.duration ?? 0
                        const left = clip.start * zoom - viewStart
                        const right = left + clipDuration * zoom
                        const visibleLeft = Math.max(0, left)
                        const visibleRight = Math.min(viewport.width, right)
                        if (!clipData?.waveform) return null
                        if (visibleRight <= visibleLeft) return null
                        return (
                          <div
                            key={clip.id}
                            className={`audiobook-clip ${selectedClip === clip.id ? 'is-selected' : ''}`}
                            style={{ left: visibleLeft, width: visibleRight - visibleLeft }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Audioblock ${clip.name} in Spur ${index + 1} verschieben`}
                            aria-description="Mit Pfeiltasten zeitlich oder zwischen Spuren verschieben."
                            aria-pressed={selectedClip === clip.id}
                            onPointerDown={(event) => {
                              if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return
                              event.stopPropagation()
                              setMenu(null)
                              const node = viewportRef.current
                              if (!node) return
                              node.setPointerCapture(event.pointerId)
                              dragRef.current = { pointerId: event.pointerId, sourceId: track.id, clipId: clip.id, startX: event.clientX, x: event.clientX, initialStart: clip.start, initialScroll: node.scrollLeft, scroll: node.scrollLeft, duration: clipDuration, moved: false, direction: 0 }
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (event.detail === 0) activateClip(track.id, clip.id, clip.start)
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                              if (busy) return
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
                            <Waveform data={clipData.waveform} width={visibleRight - visibleLeft} offset={(visibleLeft - left) + (clip.sourceStart ?? 0) * zoom} zoom={zoom} diagnostics={diagnostics} />
                          </div>
                        )
                      })}
                      {drag?.targetId === track.id && (
                        <div className="audiobook-clip-preview" style={{ left: drag.start * zoom - viewStart, width: drag.duration * zoom }} aria-hidden="true" />
                      )}
                      {clipMenu?.trackId === track.id && (() => {
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
                      {menu?.trackId === track.id && (
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
        {hasTracks && !readOnly && <div className="audiobook-position-controls" role="group" aria-label="Schnittposition verschieben">
          <div className="audiobook-position-controls-inner">
            <div className="audiobook-position-steps">
              {POSITION_STEPS.map((step) => <button key={step.label} type="button" className="audiobook-secondary" aria-label={`${step.name} zurück`} disabled={busy} onClick={() => {
                setSeekVersion((current) => current + 1)
                transport.seek(Math.round((position - step.seconds) * 1e6) / 1e6)
              }}>-{step.label}</button>)}
            </div>
            <span className="audiobook-timecode" aria-label="Schnittposition">{formatTimecode(displayedPosition)}</span>
            <div className="audiobook-position-steps">
              {[...POSITION_STEPS].reverse().map((step) => <button key={step.label} type="button" className="audiobook-secondary" aria-label={`${step.name} vor`} disabled={busy} onClick={() => {
                setSeekVersion((current) => current + 1)
                transport.seek(Math.round((position + step.seconds) * 1e6) / 1e6)
              }}>+{step.label}</button>)}
              <span className="audiobook-separator">|</span>
              <button type="button" className="audiobook-secondary" aria-label="Herauszoomen" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(1 / 1.5)}>−</button>
              <button type="button" className="audiobook-secondary" aria-label="Hineinzoomen" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(1.5)}>+</button>
            </div>
          </div>
        </div>}
        {transport.error && <p className="audiobook-transport-error" role="alert">{transport.error}</p>}
        {recording.error && <p className="audiobook-transport-error" role="alert">{recording.error} {recording.recovery && <><a href={recording.recovery.url} download={recording.recovery.name}>Aufnahme herunterladen</a>{' '}<button type="button" onClick={recording.discardRecovery}>Aufnahme verwerfen</button></>}</p>}
        {recording.phase !== 'idle' && <p role="status">{recording.phase === 'preparing' ? 'Mikrofon wird vorbereitet ...' : recording.phase === 'saving' ? 'Aufnahme wird gespeichert ...' : 'Aufnahme läuft'}</p>}
        <div className={`audiobook-transport-buttons${readOnly ? ' has-exercise-controls' : ''}`}>
          {
           transport.playing && <button type="button" className="audiobook-secondary" aria-label="Pause" disabled={busy || (!transport.playing && !transport.starting)} onClick={transport.pause}>❚❚</button>
          }
          {
            !transport.playing && <button type="button" className="audiobook-primary" aria-label="Abspielen" disabled={busy || !ready || transport.playing || transport.starting} onClick={() => void transport.play()}>▶</button>
          }
          {!readOnly && (recording.phase === 'preparing' || recording.phase === 'recording'
            ? <button type="button" className="audiobook-secondary" onClick={recording.stop}>Aufnahme stoppen</button>
            : <button type="button" className="audiobook-secondary" disabled={busy || !!recording.recovery || !onRecordSave || !tracks.some((track) => track.id === selectedTrack) || buffers.length !== allClips.length} onClick={() => {
              const target = tracks.find((track) => track.id === selectedTrack)
              if (!target) return
              setMenu(null)
              setClipMenu(null)
              const start = transport.pause()
              void recording.start(target, start, buffers, durations)
            }}>Aufnehmen</button>)}
          {readOnly && <div className="audiobook-exercise-controls" ref={setMicrophoneTarget} />}
        </div>
        {readOnly && <div className="audiobook-transport-settings" ref={setSettingsTarget} />}
      </div>
    </>
  )
}

async function missingRecordingSave(): Promise<void> {
  throw new Error('Das Speichern von Aufnahmen ist nicht verfügbar.')
}
