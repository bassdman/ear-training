import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'

import { TooltipMenu, TooltipMenuButton } from '../../components/TooltipMenu'
import { createProjectId, readProjects, writeProjects, type AudiobookProject } from './storage'
import { deleteProjectTracks } from './audioStorage'
import { ProjectTracks } from './ProjectTracks'
import { ProjectDetails } from './ProjectDetails'
import { ProjectExport } from './ProjectExport'
import { importProjectArchive } from './projectArchive'
import { downloadPlaybackDiagnostics, PlaybackDiagnostics } from './playbackDiagnostics'
import './audiobookPage.css'

const DEVELOPMENT_KEY = 'ear-training-audiobook-development'

function readDevelopmentSetting() {
  try {
    return { enabled: localStorage.getItem(DEVELOPMENT_KEY) === 'true', error: '' }
  } catch (cause) {
    console.error('Development-Einstellung konnte nicht geladen werden:', cause)
    return { enabled: false, error: 'Die Development-Einstellung konnte nicht geladen werden.' }
  }
}

export function AudiobookPage() {
  const { projectId } = useParams()
  const isExercise = useMatch('/audiobook/:projectId/exercise') !== null
  const isDetails = useMatch('/audiobook/:projectId/details') !== null
  const isExport = useMatch('/audiobook/:projectId/export') !== null
  const navigate = useNavigate()
  const [projects, setProjects] = useState<AudiobookProject[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [listMenuId, setListMenuId] = useState<string | null>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [developmentSetting] = useState(readDevelopmentSetting)
  const [development, setDevelopment] = useState(developmentSetting.enabled)
  const [developmentError, setDevelopmentError] = useState(developmentSetting.error)
  const [developmentMenu, setDevelopmentMenu] = useState(false)
  const diagnostics = useMemo(() => development && projectId ? new PlaybackDiagnostics() : null, [development, projectId])
  const [traceMenuTarget, setTraceMenuTarget] = useState<HTMLDivElement | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!diagnostics) return
    diagnostics.start()
    return () => diagnostics.stop()
  }, [diagnostics])

  function changeDevelopment(enabled: boolean) {
    try {
      localStorage.setItem(DEVELOPMENT_KEY, String(enabled))
      setDevelopment(enabled)
      setDevelopmentError('')
    } catch (cause) {
      console.error('Development-Einstellung konnte nicht gespeichert werden:', cause)
      setDevelopmentError('Die Development-Einstellung konnte nicht gespeichert werden.')
    }
  }

  useEffect(() => {
    let active = true
    readProjects().then((saved) => {
      if (active) setProjects(saved)
    }).catch(() => {
      if (active) setError('Die Projekte konnten nicht geladen werden. Bitte prüfe den lokalen Speicher.')
    })
    return () => { active = false }
  }, [])

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Bitte gib einen Projektnamen ein.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const current = await readProjects()
      const project = { id: createProjectId(), name: trimmedName }
      const updated = [...current, project]
      await writeProjects(updated)
      setProjects(updated)
      setName('')
    } catch {
      setError('Das Projekt konnte nicht gespeichert werden. Bitte prüfe den lokalen Speicher.')
    } finally {
      setBusy(false)
    }
  }

  async function importProject(file: File) {
    setBusy(true)
    setError('')
    try {
      setProjects(await importProjectArchive(file))
    } catch (cause) {
      setError(`Projekt konnte nicht importiert werden: ${cause instanceof Error ? cause.message : 'Unbekannter Fehler.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function deleteProject(id: string) {
    setBusy(true)
    setError('')
    try {
      const current = await readProjects()
      const updated = current.filter((project) => project.id !== id)
      await writeProjects(updated)
      try {
        await deleteProjectTracks(id)
      } catch {
        try {
          await writeProjects(current)
        } catch {
          setProjects(updated)
          setDeleteId(null)
          setError('Das Projekt wurde gelöscht, aber seine Projektdaten konnten nicht entfernt werden.')
          return
        }
        setError('Die Projektdaten konnten nicht gelöscht werden. Das Projekt wurde beibehalten.')
        return
      }
      setProjects(updated)
      setDeleteId(null)
      if (projectId === id) navigate('/audiobook')
    } catch {
      setError('Das Projekt konnte nicht gelöscht werden. Bitte prüfe den lokalen Speicher.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    setProjectMenuOpen(false)
    setDevelopmentMenu(false)
    setListMenuId(null)
    setDeleteId(null)
    setRenaming(false)
    setRenameError('')
  }, [projectId])

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renaming])

  async function renameProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError('Bitte gib einen Projektnamen ein.')
      return
    }
    if (!projectId || busy) return
    setBusy(true)
    setRenameError('')
    try {
      const current = await readProjects()
      if (!current.some((item) => item.id === projectId)) {
        setRenameError('Das Projekt wurde nicht gefunden und konnte nicht umbenannt werden.')
        return
      }
      const updated = current.map((item) => item.id === projectId ? { ...item, name: trimmed } : item)
      await writeProjects(updated)
      setProjects(updated)
      setRenaming(false)
      menuButtonRef.current?.focus()
    } catch {
      setRenameError('Der Projektname konnte nicht gespeichert werden. Bitte prüfe den lokalen Speicher.')
    } finally {
      setBusy(false)
    }
  }

  const project = projects?.find((item) => item.id === projectId)

  return (
    <main className={`audiobook-page ${projectId ? 'audiobook-page-project' : ''}`}>
      <div className="audiobook-shell">
        {projectId ? (
          <div className="audiobook-project-navigation">
            <header className="audiobook-project-topbar">
              <Link className="audiobook-project-back" to="/audiobook" aria-label="Zurück zum Audiobook">←</Link>
              <h1 title={project?.name}>{project?.name ?? 'Projekt'}</h1>
              {project && <div className="audiobook-project-menu-anchor">
                <button ref={menuButtonRef} type="button" className="audiobook-project-menu-trigger" aria-label="Projektoptionen" aria-expanded={projectMenuOpen} onPointerDown={(event) => event.stopPropagation()} onClick={() => { setProjectMenuOpen((open) => !open); setDevelopmentMenu(false) }}>...</button>
                {projectMenuOpen && <TooltipMenu className="audiobook-project-menu" onClose={() => { setProjectMenuOpen(false); setDevelopmentMenu(false) }}>
                  <TooltipMenuButton onClick={() => { setRenameValue(project.name); setRenameError(''); setRenaming(true); setProjectMenuOpen(false) }}>Projektnamen ändern</TooltipMenuButton>
                  <TooltipMenuButton aria-expanded={developmentMenu} onClick={() => setDevelopmentMenu((open) => !open)}>Development</TooltipMenuButton>
                  {developmentMenu && <div className="audiobook-development-menu">
                    <label><input type="checkbox" checked={development} onChange={(event) => changeDevelopment(event.currentTarget.checked)} /> Development aktivieren</label>
                    {development && diagnostics && <>
                      <TooltipMenuButton onClick={() => {
                        try {
                          downloadPlaybackDiagnostics(diagnostics)
                          setDevelopmentError('')
                          setProjectMenuOpen(false)
                        } catch (cause) {
                          console.error('Wiedergabe-Debuglog konnte nicht heruntergeladen werden:', cause)
                          setDevelopmentError('Das Wiedergabe-Debuglog konnte nicht heruntergeladen werden.')
                        }
                      }}>Wiedergabe-Debuglog herunterladen</TooltipMenuButton>
                      {isExercise && <div ref={setTraceMenuTarget} />}
                    </>}
                  </div>}
                </TooltipMenu>}
              </div>}
            </header>
            <nav className="audiobook-project-nav" aria-label="Projektansichten">
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}`} aria-current={!isExercise && !isDetails && !isExport ? 'page' : undefined}>Edit</Link>
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}/details`} aria-current={isDetails ? 'page' : undefined}>Lyrics &amp; PDFs</Link>
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}/exercise`} aria-current={isExercise ? 'page' : undefined}>Exercise</Link>
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}/export`} aria-current={isExport ? 'page' : undefined}>Export</Link>
            </nav>
          </div>
        ) : (
          <Link className="audiobook-back" to="/">Zur Startseite</Link>
        )}
        {!projectId && <header className="audiobook-header">
          <p className="audiobook-kicker">Songstudio</p>
          <h1>Audiobook</h1>
          <p>Hier verwaltest du deine Lieder und Aufnahmen als Projekte.</p>
        </header>}

        {project && renaming && (
          <form className="audiobook-rename" onSubmit={(event) => void renameProject(event)} onKeyDown={(event) => {
            if (event.key === 'Escape' && !busy) {
              setRenaming(false)
              setRenameError('')
              menuButtonRef.current?.focus()
            }
          }}>
            <label htmlFor="audiobook-rename-project">Projektname</label>
            <div className="audiobook-create-row">
              <input ref={renameInputRef} id="audiobook-rename-project" value={renameValue} maxLength={120} disabled={busy} onChange={(event) => setRenameValue(event.target.value)} />
              <button type="submit" className="audiobook-primary" disabled={busy}>Speichern</button>
              <button type="button" className="audiobook-secondary" disabled={busy} onClick={() => { setRenaming(false); setRenameError(''); menuButtonRef.current?.focus() }}>Abbrechen</button>
            </div>
            {renameError && <p className="audiobook-error" role="alert">{renameError}</p>}
          </form>
        )}

        {error && <p className="audiobook-error" role="alert">{error}</p>}
        {developmentError && <p className="audiobook-error" role="alert">{developmentError}</p>}
        {projects === null ? (
          !error && <p>Lade Projekte ...</p>
        ) : projectId ? (
          project ? (
            isDetails ? <ProjectDetails key={project.id} projectId={project.id} /> :
              isExport ? <ProjectExport key={project.id} project={project} /> :
              <ProjectTracks key={project.id} projectId={project.id} readOnly={isExercise} diagnostics={diagnostics} traceMenuTarget={isExercise && development ? traceMenuTarget : null} onTraceDownload={() => setProjectMenuOpen(false)} />
          ) : (
            <p>Dieses Projekt wurde nicht gefunden.</p>
          )
        ) : (
          <>
            <section className="audiobook-projects" aria-labelledby="audiobook-projects-title">
              <h2 id="audiobook-projects-title">Deine Projekte</h2>
              {projects.length === 0 ? (
                <p className="audiobook-empty">Noch keine Projekte vorhanden. Füge dein erstes Lied oder deine erste Aufnahme hinzu.</p>
              ) : (
                <ul className="audiobook-list">
                  {projects.map((item) => (
                    <li className="audiobook-project" key={item.id}>
                      <span className="audiobook-project-name">{item.name}</span>
                      <div className="audiobook-project-actions">
                        <Link className="audiobook-project-action" aria-label={`${item.name} bearbeiten`} to={`/audiobook/${encodeURIComponent(item.id)}`}>Edit</Link>
                        <Link className="audiobook-project-action" aria-label={`${item.name} üben`} to={`/audiobook/${encodeURIComponent(item.id)}/exercise`}>Exercise</Link>
                        <div className="audiobook-list-menu-anchor">
                          <button type="button" className="audiobook-secondary audiobook-list-menu-trigger" aria-label={`Optionen für ${item.name}`}
                            aria-expanded={listMenuId === item.id} disabled={busy} onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => { setDeleteId(null); setListMenuId((current) => current === item.id ? null : item.id) }}>...</button>
                          {listMenuId === item.id && <TooltipMenu className="audiobook-list-menu" onClose={() => setListMenuId(null)}>
                            <TooltipMenuButton className="audiobook-list-delete" disabled={busy} onClick={() => { setListMenuId(null); setDeleteId(item.id) }}>
                              Projekt löschen
                            </TooltipMenuButton>
                          </TooltipMenu>}
                        </div>
                      </div>
                      {deleteId === item.id ? (
                        <div className="audiobook-delete-confirm">
                          <span>„{item.name}“ wirklich löschen?</span>
                          <button type="button" className="audiobook-danger" disabled={busy} onClick={() => void deleteProject(item.id)}>
                            Endgültig löschen
                          </button>
                          <button type="button" className="audiobook-secondary" disabled={busy} onClick={() => setDeleteId(null)}>
                            Abbrechen
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <form className="audiobook-create" onSubmit={createProject}>
              <label htmlFor="audiobook-project-name">Projektname</label>
              <div className="audiobook-create-row">
                <input
                  id="audiobook-project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name des Liedes oder der Aufnahme"
                  maxLength={120}
                />
                <button className="audiobook-primary" type="submit" disabled={busy}>
                  Projekt hinzufügen
                </button>
              </div>
            </form>
            <div className="audiobook-import-project">
              <label htmlFor="audiobook-import-project">Projektdatei importieren (.vst)</label>
              <input id="audiobook-import-project" type="file" accept=".vst,application/zip" disabled={busy} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void importProject(file)
              }} />
              {busy && <p role="status">Bitte warten ...</p>}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
