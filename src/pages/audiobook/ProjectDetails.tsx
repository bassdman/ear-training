import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'

import { TooltipMenu, TooltipMenuButton } from '../../components/TooltipMenu'
import {
  deleteProjectDocument, deleteProjectLyrics, readProjectDocuments, readProjectLyrics, readVocalTracks,
  saveProjectDocument, saveProjectLyrics, type AudioTrack, type ProjectDocument, type ProjectLyrics,
} from './audioStorage'
import { createProjectId } from './storage'

type VocalTrack = Pick<AudioTrack, 'id' | 'name'>

function LyricsEditor({ lyrics, tracks, busy, autoEdit, onSave, onDelete }: {
  lyrics: ProjectLyrics, tracks: VocalTrack[], busy: boolean,
  autoEdit: boolean, onSave: (lyrics: ProjectLyrics) => Promise<void>, onDelete: (id: string) => void,
}) {
  const [draft, setDraft] = useState(lyrics)
  const latest = useRef(lyrics)
  const saved = useRef(lyrics)
  const saving = useRef(false)
  const mounted = useRef(true)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [editing, setEditing] = useState(autoEdit)
  const [menuOpen, setMenuOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useLayoutEffect(() => {
    const node = textarea.current
    if (!node) return
    const resize = () => {
      node.style.height = 'auto'
      node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`
    }
    resize()
    let width = node.clientWidth
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (width !== node.clientWidth) { width = node.clientWidth; resize() }
    })
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [draft.text, editing])

  useEffect(() => {
    if (editing) textarea.current?.focus()
  }, [editing])

  useEffect(() => {
    if (saveState === 'saved') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const guardLinks = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return
      if (!window.confirm('Der Liedtext ist noch nicht gespeichert. Seite trotzdem verlassen?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLinks, true)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLinks, true) }
  }, [saveState])

  async function flush() {
    if (saving.current) return
    saving.current = true
    if (mounted.current) { setSaveState('saving'); setSaveError('') }
    try {
      while (saved.current !== latest.current) {
        const next = latest.current
        await onSave(next)
        saved.current = next
      }
      if (mounted.current) setSaveState('saved')
    } catch (cause) {
      console.error('Liedtext konnte nicht gespeichert werden:', cause)
      if (mounted.current) {
        setSaveState('error')
        setSaveError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht gespeichert werden.')
      }
    } finally {
      saving.current = false
    }
  }

  function update(patch: Partial<Pick<ProjectLyrics, 'text' | 'trackId'>>) {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setDraft(next)
    void flush()
  }

  const assignedTrack = tracks.find((track) => track.id === draft.trackId)
  return <article className="audiobook-details-card audiobook-lyrics-card">
    <div className="audiobook-lyrics-header">
      <span className="audiobook-lyrics-track">{assignedTrack ? `Vocalspur: ${assignedTrack.name}` : 'Keine Vocalspur zugewiesen'}</span>
      <div className="audiobook-lyrics-menu-anchor">
        <button type="button" className="audiobook-project-menu-trigger" aria-label="Optionen für Liedtext" aria-expanded={menuOpen} onPointerDown={(event) => event.stopPropagation()} onClick={() => { setMenuOpen((open) => !open); setAssigning(false); setConfirmDelete(false) }}>...</button>
        {menuOpen && <TooltipMenu className="audiobook-lyrics-menu" onClose={() => { setMenuOpen(false); setAssigning(false); setConfirmDelete(false) }}>
          {confirmDelete ? <>
            <span>Liedtext wirklich löschen?</span>
            <TooltipMenuButton disabled={busy || saveState === 'saving'} onClick={() => onDelete(lyrics.id)}>Endgültig löschen</TooltipMenuButton>
            <TooltipMenuButton onClick={() => setConfirmDelete(false)}>Abbrechen</TooltipMenuButton>
          </> : assigning ? <>
            <label htmlFor={`lyrics-track-${lyrics.id}`}>Vocalspur</label>
            <select id={`lyrics-track-${lyrics.id}`} value={assignedTrack?.id ?? ''} disabled={busy} onChange={(event) => {
              update({ trackId: event.target.value || null })
              setMenuOpen(false)
              setAssigning(false)
            }}>
              <option value="">Nicht zugewiesen</option>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
            </select>
          </> : <>
            <TooltipMenuButton disabled={busy} onClick={() => { setEditing((current) => !current); setMenuOpen(false) }}>{editing ? 'Bearbeitung beenden' : 'Text bearbeiten'}</TooltipMenuButton>
            <TooltipMenuButton disabled={busy} onClick={() => setAssigning(true)}>Spur zuordnen</TooltipMenuButton>
            <TooltipMenuButton disabled={busy} onClick={() => setConfirmDelete(true)}>Text löschen</TooltipMenuButton>
          </>}
        </TooltipMenu>}
      </div>
    </div>
    {editing
      ? <textarea ref={textarea} aria-label="Liedtext" rows={1} value={draft.text} disabled={busy} onChange={(event) => update({ text: event.target.value })} />
      : <div className="audiobook-lyrics-text">{draft.text || 'Noch kein Liedtext.'}</div>}
    {saveState === 'saving' && <span className="audiobook-lyrics-save-status" role="status">Speichert ...</span>}
    {saveState === 'error' && <div className="audiobook-error" role="alert">Liedtext nicht gespeichert: {saveError} <button type="button" onClick={() => void flush()}>Erneut versuchen</button></div>}
  </article>
}

function DocumentEditor({ document, busy, onSave, onDelete, onOpen }: {
  document: ProjectDocument, busy: boolean, onSave: (document: ProjectDocument) => void,
  onDelete: (id: string) => void, onOpen: (document: ProjectDocument) => void,
}) {
  const [name, setName] = useState(document.name)
  const [description, setDescription] = useState(document.description)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return <form className="audiobook-details-card" onSubmit={(event) => {
    event.preventDefault()
    onSave({ ...document, name: name.trim(), description })
  }}>
    <label htmlFor={`document-name-${document.id}`}>Name</label>
    <input id={`document-name-${document.id}`} value={name} required disabled={busy} onChange={(event) => setName(event.target.value)} />
    <label htmlFor={`document-description-${document.id}`}>Beschreibung (optional)</label>
    <textarea id={`document-description-${document.id}`} rows={3} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} />
    <div className="audiobook-details-actions">
      <button className="audiobook-secondary" type="button" onClick={() => onOpen(document)}>PDF öffnen</button>
      <button className="audiobook-primary" type="submit" disabled={busy}>Dokument speichern</button>
      {confirmDelete ? <>
        <span>Dokument wirklich löschen?</span>
        <button className="audiobook-danger" type="button" disabled={busy} onClick={() => onDelete(document.id)}>Endgültig löschen</button>
        <button className="audiobook-secondary" type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Abbrechen</button>
      </> : <button className="audiobook-secondary" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Dokument löschen</button>}
    </div>
  </form>
}

function checkPdf(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!file.size) { reject(new Error('Die PDF-Datei ist leer.')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'))
    reader.onabort = () => reject(new Error('Das Lesen der Datei wurde abgebrochen.'))
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) { reject(new Error('Die Datei konnte nicht gelesen werden.')); return }
      const header = new TextDecoder('latin1').decode(reader.result)
      if (!header.includes('%PDF-')) reject(new Error('Bitte wähle eine gültige PDF-Datei.'))
      else resolve()
    }
    reader.readAsArrayBuffer(file.slice(0, 1024))
  })
}

export function ProjectDetails({ projectId }: { projectId: string }) {
  const [lyrics, setLyrics] = useState<ProjectLyrics[] | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [tracks, setTracks] = useState<VocalTrack[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [newLyricsId, setNewLyricsId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    const currentUrls = urls.current
    Promise.all([readProjectLyrics(projectId), readProjectDocuments(projectId), readVocalTracks(projectId)])
      .then(([savedLyrics, savedDocuments, savedTracks]) => {
        if (active) { setLyrics(savedLyrics); setDocuments(savedDocuments); setTracks(savedTracks) }
      }).catch(() => { if (active) setError('Liedtexte und Dokumente konnten nicht geladen werden. Bitte prüfe den lokalen Speicher.') })
    return () => { active = false; currentUrls.forEach((url) => URL.revokeObjectURL(url)); currentUrls.clear() }
  }, [projectId])

  async function perform(action: () => Promise<void>, success: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setStatus('')
    try { await action(); setStatus(success) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }

  function addLyrics() {
    void perform(async () => {
      const entry: ProjectLyrics = { id: createProjectId(), projectId, text: '', trackId: null, createdAt: Date.now() }
      await saveProjectLyrics(entry)
      setLyrics((current) => [...(current ?? []), entry])
      setNewLyricsId(entry.id)
    }, 'Liedtext hinzugefügt.')
  }

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void perform(async () => {
      if (!name.trim()) throw new Error('Bitte gib einen Namen für das Dokument ein.')
      if (!file) throw new Error('Bitte wähle eine PDF-Datei.')
      await checkPdf(file)
      const entry: ProjectDocument = { id: createProjectId(), projectId, name: name.trim(), description, pdf: new Blob([file], { type: 'application/pdf' }), createdAt: Date.now() }
      await saveProjectDocument(entry)
      setDocuments((current) => [...current, entry])
      setName('')
      setDescription('')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    }, 'Dokument hinzugefügt.')
  }

  function openDocument(document: ProjectDocument) {
    setError('')
    let url: string | undefined
    try {
      url = URL.createObjectURL(document.pdf)
      const opened = window.open(url, '_blank')
      if (!opened) throw new Error('Das PDF konnte nicht geöffnet werden. Bitte erlaube Pop-ups.')
      opened.opener = null
      urls.current.add(url)
    } catch (cause) {
      if (url) URL.revokeObjectURL(url)
      setError(cause instanceof Error ? cause.message : 'Das PDF konnte nicht geöffnet werden.')
    }
  }

  return <div className="audiobook-details">
    {error && <p className="audiobook-error" role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    {lyrics === null ? (!error && <p>Lade Liedtexte und Dokumente ...</p>) : <>
      <section aria-labelledby="lyrics-title">
        <h2 id="lyrics-title">Lyrics</h2>
        {lyrics.length === 0 && <p>Noch keine Liedtexte vorhanden.</p>}
        {lyrics.map((entry) => <LyricsEditor key={entry.id} lyrics={entry} tracks={tracks} busy={busy} autoEdit={entry.id === newLyricsId}
          onSave={async (updated) => {
            await saveProjectLyrics(updated)
            setLyrics((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? [])
          }}
          onDelete={(id) => void perform(async () => {
            await deleteProjectLyrics(id)
            setLyrics((current) => current?.filter((item) => item.id !== id) ?? [])
          }, 'Liedtext gelöscht.')} />)}
        <button className="audiobook-secondary" type="button" disabled={busy} onClick={addLyrics}>Liedtext hinzufügen</button>
      </section>
      <section aria-labelledby="documents-title">
        <h2 id="documents-title">Weitere Dokumente</h2>
        {documents.length === 0 && <p>Noch keine Dokumente vorhanden.</p>}
        {documents.map((entry) => <DocumentEditor key={entry.id} document={entry} busy={busy} onOpen={openDocument}
          onSave={(updated) => void perform(async () => {
            if (!updated.name) throw new Error('Bitte gib einen Namen für das Dokument ein.')
            await saveProjectDocument(updated)
            setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item))
          }, 'Dokument gespeichert.')}
          onDelete={(id) => void perform(async () => {
            await deleteProjectDocument(id)
            setDocuments((current) => current.filter((item) => item.id !== id))
          }, 'Dokument gelöscht.')} />)}
        <form className="audiobook-details-card" onSubmit={addDocument}>
          <h3>PDF hinzufügen</h3>
          <label htmlFor="new-document-name">Name</label>
          <input id="new-document-name" value={name} required disabled={busy} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="new-document-description">Beschreibung (optional)</label>
          <textarea id="new-document-description" rows={3} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} />
          <label htmlFor="new-document-file">PDF-Datei</label>
          <input ref={fileInput} id="new-document-file" type="file" accept=".pdf,application/pdf" required disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <div className="audiobook-details-actions"><button className="audiobook-primary" type="submit" disabled={busy}>PDF hinzufügen</button></div>
        </form>
      </section>
    </>}
  </div>
}
