import { useCallback, useEffect, useRef, useState } from 'react'

import { createUndoRedoHistory } from '../../features/undoRedo/history'
import { addClip, addEmptyTrack, deleteClip, duplicateTrack, getTrackClips, insertRecording, markTrackDeleted, moveClip, pasteClip, purgeDeletedTracks, readTracks, restoreProjectTracks, splitClip, updateTrackMix, type AudioClip, type AudioTrack, type TrackMix, type TrackType } from './audioStorage'
import { createProjectId } from './storage'
import { AudioTimeline } from './AudioTimeline'
import { decodeWaveform } from './waveform'
import { useWordSeparation } from '../../features/wordSeparation/useWordSeparation'
import type { PlaybackDiagnostics } from './playbackDiagnostics'

const AUDIO_EXTENSION = /\.(aac|aif|aiff|amr|caf|flac|m4a|m4b|mp3|mp4|mpga|oga|ogg|opus|wav|wave|webm)$/i

export function ProjectTracks({ projectId, readOnly = false, traceMenuTarget = null, onTraceDownload, diagnostics }: {
  projectId: string, readOnly?: boolean, traceMenuTarget?: HTMLElement | null, onTraceDownload?: () => void, diagnostics?: PlaybackDiagnostics | null
}) {
  const [tracks, setTracks] = useState<AudioTrack[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [mixError, setMixError] = useState('')
  const [, forceHistoryRender] = useState(0)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const pruneQueue = useRef<Promise<void>>(Promise.resolve())
  const tracksRef = useRef<AudioTrack[] | null>(null)
  const historyAction = useRef(false)
  const historyRef = useRef(createUndoRedoHistory<AudioTrack[]>([]))
  const scheduleDeletedTrackPrune = useCallback(() => {
    const retainedTrackIds = new Set(historyRef.current.values().flatMap((snapshot) => snapshot.map((track) => track.id)))
    pruneQueue.current = pruneQueue.current.then(() => purgeDeletedTracks(projectId, retainedTrackIds)).catch(() => {
      setError('Gelöschte Spuren konnten nicht endgültig aus dem Browserspeicher entfernt werden.')
    })
  }, [projectId])
  function commitTracks(next: AudioTrack[]) {
    tracksRef.current = next
    historyRef.current.commit(next)
    setTracks(next)
    forceHistoryRender((version) => version + 1)
    scheduleDeletedTrackPrune()
  }
  function resetTracks(next: AudioTrack[]) {
    tracksRef.current = next
    historyRef.current.reset(next)
    setTracks(next)
    forceHistoryRender((version) => version + 1)
  }
  const separation = useWordSeparation(projectId, (updated) => {
    const current = tracksRef.current
    if (current) commitTracks(current.map((track) => track.id === updated.id ? updated : track))
  })
  const editingBusy = busy || separation.busy || recordingBusy

  useEffect(() => {
    let active = true
    purgeDeletedTracks(projectId, new Set()).then(() => readTracks(projectId)).then((saved) => {
      if (active) resetTracks(saved)
    }).catch(() => {
      if (active) setError('Die Audiospuren konnten nicht geladen werden. Bitte prüfe den Browserspeicher.')
    })
    return () => { active = false }
  }, [projectId])

  const restoreSnapshot = useCallback(async (direction: 'undo' | 'redo') => {
    if (editingBusy || readOnly || historyAction.current) return
    historyAction.current = true
    setBusy(true)
    setError('')
    const history = historyRef.current
    let snapshot: AudioTrack[] | undefined
    try {
      await writeQueue.current
      snapshot = direction === 'undo' ? history.undo() : history.redo()
      if (!snapshot) return
      await restoreProjectTracks(projectId, snapshot)
      tracksRef.current = snapshot
      setTracks(snapshot)
      forceHistoryRender((version) => version + 1)
      scheduleDeletedTrackPrune()
    } catch {
      if (snapshot) {
        if (direction === 'undo') history.redo()
        else history.undo()
        forceHistoryRender((version) => version + 1)
      }
      setError(direction === 'undo'
        ? 'Die Änderung konnte nicht rückgängig gemacht werden. Bitte prüfe den Browserspeicher.'
        : 'Die Änderung konnte nicht wiederhergestellt werden. Bitte prüfe den Browserspeicher.')
    } finally {
      historyAction.current = false
      setBusy(false)
    }
  }, [editingBusy, projectId, readOnly, scheduleDeletedTrackPrune])

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (readOnly || !(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement
        && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        void restoreSnapshot(event.shiftKey ? 'redo' : 'undo')
      } else if (key === 'y') {
        event.preventDefault()
        void restoreSnapshot('redo')
      }
    }
    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [readOnly, restoreSnapshot])

  async function importAudio(trackId: string, start: number, durations: Record<string, number>, file: File) {
    if (!file.type.startsWith('audio/') && file.type !== '' && !AUDIO_EXTENSION.test(file.name)) {
      setError('Bitte wähle eine Audiodatei aus.')
      return
    }
    if (file.size === 0) {
      setError('Die ausgewählte Audiodatei ist leer.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const { waveform } = await decodeWaveform(file)
      const track = tracks?.find((item) => item.id === trackId)
      if (!track) throw new Error('Spur nicht gefunden')
      if (!Number.isFinite(waveform.duration) || waveform.duration <= 0) throw new Error('Ungültige Audiodauer')
      const overlapping = getTrackClips(track).some((clip) =>
        start < clip.start + (durations[clip.id] ?? clip.duration ?? 0) && start + waveform.duration > clip.start,
      )
      if (overlapping) {
        setError('Der Audioblock würde einen vorhandenen Block überlappen. Bitte wähle eine andere Position.')
        return
      }
      const clip = { id: createProjectId(), name: file.name, audio: file, start, duration: waveform.duration }
      await addClip(trackId, clip, durations)
      const current = tracksRef.current
      if (current) commitTracks(current.map((item) => item.id === trackId
        ? { ...item, clips: [...getTrackClips(item), clip] }
        : item))
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'Audioblock überlappt'
        ? 'Der Audioblock würde einen vorhandenen Block überlappen. Bitte wähle eine andere Position.'
        : 'Die Audiodatei konnte nicht importiert werden. Bitte prüfe das Format und den verfügbaren Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function createTrack(type: TrackType) {
    setBusy(true)
    setError('')
    try {
      const track = await addEmptyTrack(projectId, type)
      const current = tracksRef.current
      if (current) commitTracks([...current, track])
    } catch {
      setError('Die Spur konnte nicht gespeichert werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function moveAudio(sourceId: string, targetId: string, clipId: string, start: number, durations: Record<string, number>) {
    setBusy(true)
    setError('')
    try {
      await moveClip(sourceId, targetId, clipId, start, durations)
      const current = tracksRef.current
      if (!current) return
      const clip = current.flatMap(getTrackClips).find((item) => item.id === clipId)
      if (!clip) return
      const updated = { ...clip, start, duration: clip.duration ?? durations[clip.id] }
      commitTracks(current.map((track) => {
        if (track.id !== sourceId && track.id !== targetId) return track
        const remaining = getTrackClips(track).filter((item) => item.id !== clipId)
        return { ...track, clips: track.id === targetId ? [...remaining, updated] : remaining }
      }))
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('überlappt')
        ? 'Der Audioblock kann dort nicht abgelegt werden: Ein Block überlappt oder seine Dauer ist unbekannt.'
        : 'Der Audioblock konnte nicht verschoben werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function splitAudio(trackId: string, clipId: string, at: number, duration: number) {
    setBusy(true)
    setError('')
    try {
      await splitClip(trackId, clipId, at, duration)
      commitTracks(await readTracks(projectId))
    } catch {
      setError('Der Audioblock konnte nicht geschnitten werden. Bitte prüfe die Schnittposition und den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function pasteAudio(trackId: string, start: number, durations: Record<string, number>, clip: AudioClip) {
    setBusy(true)
    setError('')
    try {
      await pasteClip(projectId, trackId, clip, start, durations)
      commitTracks(await readTracks(projectId))
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('überlappt')
        ? 'Der Audioblock kann dort nicht eingefügt werden: Ein Block überlappt oder seine Dauer ist unbekannt.'
        : 'Der Audioblock konnte nicht eingefügt werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAudio(trackId: string, clipId: string) {
    setBusy(true)
    setError('')
    try {
      await deleteClip(trackId, clipId)
      const current = tracksRef.current
      if (current) commitTracks(current.map((track) => track.id === trackId
        ? { ...track, audio: undefined, clips: getTrackClips(track).filter((clip) => clip.id !== clipId) }
        : track))
    } catch {
      setError('Der Audioblock konnte nicht gelöscht werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function removeTrack(trackId: string) {
    setBusy(true)
    setError('')
    try {
      await writeQueue.current
      await markTrackDeleted(trackId)
      const current = tracksRef.current
      if (current) commitTracks(current.filter((track) => track.id !== trackId))
    } catch {
      setError('Die Spur konnte nicht gelöscht werden. Bitte prüfe den Browserspeicher.')
    } finally {
      setBusy(false)
    }
  }

  async function copyTrack(trackId: string) {
    setBusy(true)
    setError('')
    try {
      await writeQueue.current
      const id = await duplicateTrack(projectId, trackId)
      const duplicate = (await readTracks(projectId)).find((track) => track.id === id)
      if (!duplicate) throw new Error('Duplizierte Spur nicht gefunden')
      const current = tracksRef.current
      if (current) commitTracks([...current, duplicate])
    } catch {
      setError('Die Spur konnte nicht dupliziert werden. Bitte prüfe den Browserspeicher und lade das Projekt bei Bedarf erneut.')
    } finally {
      setBusy(false)
    }
  }

  function changeTrackMix(id: string, patch: Partial<TrackMix>) {
    const operation = writeQueue.current.then(async () => {
      await updateTrackMix(id, patch)
      commitTracks(await readTracks(projectId))
      setMixError('')
    })
    writeQueue.current = operation.catch(() => {
      setMixError('Die Spureinstellung konnte nicht gespeichert werden. Sie gilt nur bis zum erneuten Öffnen.')
    })
  }

  async function saveRecording(track: AudioTrack, clip: AudioClip, durations: Record<string, number>) {
    await writeQueue.current
    await insertRecording(track, clip, durations)
    try {
      commitTracks(await readTracks(projectId))
    } catch {
      setError('Die Aufnahme wurde gespeichert, aber die Spuren konnten nicht aktualisiert werden. Bitte lade das Projekt erneut.')
    }
  }

  return (
    <section aria-label="Audiospuren" className="audiobook-tracks">
      {error && <p className="audiobook-error" role="alert">{error}</p>}
      {mixError && <p className="audiobook-error" role="alert">{mixError}</p>}
      {separation.error && <p className="audiobook-error" role="alert">{separation.error}</p>}
      {separation.status && <p role="status">{separation.status}</p>}
      {tracks === null ? (
        !error && <p>Lade Audiospuren ...</p>
      ) : (
        <>
          {readOnly && tracks.length === 0 && <p>Noch keine Spuren vorhanden. Füge im Editmodus eine Spur hinzu.</p>}
          <AudioTimeline tracks={tracks} readOnly={readOnly} traceMenuTarget={traceMenuTarget} onTraceDownload={onTraceDownload} diagnostics={diagnostics} onMixChange={changeTrackMix} onImport={(...args) => void importAudio(...args)} onPaste={(...args) => void pasteAudio(...args)} onMove={(...args) => void moveAudio(...args)} onSplit={(...args) => void splitAudio(...args)} onDelete={(...args) => void deleteAudio(...args)} onDeleteTrack={(id) => void removeTrack(id)} onDuplicateTrack={(id) => void copyTrack(id)} onSeparateTrack={(id) => void separation.separate(id)} onRecordSave={saveRecording} onRecordingBusyChange={setRecordingBusy} busy={editingBusy} canUndo={historyRef.current.canUndo()} canRedo={historyRef.current.canRedo()} onUndo={() => void restoreSnapshot('undo')} onRedo={() => void restoreSnapshot('redo')} />
          {!readOnly && <div className="audiobook-add-buttons" role="group" aria-label="Spur hinzufügen">
            <button type="button" className="audiobook-secondary" disabled={editingBusy} onClick={() => void createTrack('vocal')}>
              <span aria-hidden="true">+</span> Vocalspur
            </button>
            <button type="button" className="audiobook-secondary" disabled={editingBusy} onClick={() => void createTrack('instrumental')}>
              <span aria-hidden="true">+</span> Instrumentalspur
            </button>
            <button type="button" className="audiobook-secondary" disabled={editingBusy} onClick={() => void createTrack('mixed')}>
              <span aria-hidden="true">+</span> Mixed-Spur
            </button>
          </div>}
        </>
      )}
    </section>
  )
}
