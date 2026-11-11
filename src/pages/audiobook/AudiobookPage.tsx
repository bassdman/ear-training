import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'

import { TooltipMenu, TooltipMenuButton } from '../../components/TooltipMenu'
import { createProjectId, readProjects, writeProjects, type AudiobookProject } from './storage'
import { deleteProjectTracks } from './audioStorage'
import { ProjectTracks } from './ProjectTracks'
import './audiobookPage.css'

export function AudiobookPage() {
  const { projectId } = useParams()
  const isExercise = useMatch('/audiobook/:projectId/exercise') !== null
  const navigate = useNavigate()
  const [projects, setProjects] = useState<AudiobookProject[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

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
          setError('Das Projekt wurde gelöscht, aber seine Audiodaten konnten nicht entfernt werden.')
          return
        }
        setError('Die Audiodaten konnten nicht gelöscht werden. Das Projekt wurde beibehalten.')
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
                <button ref={menuButtonRef} type="button" className="audiobook-project-menu-trigger" aria-label="Projektoptionen" aria-expanded={projectMenuOpen} onPointerDown={(event) => event.stopPropagation()} onClick={() => setProjectMenuOpen((open) => !open)}>...</button>
                {projectMenuOpen && <TooltipMenu className="audiobook-project-menu" onClose={() => setProjectMenuOpen(false)}>
                  <TooltipMenuButton onClick={() => { setRenameValue(project.name); setRenameError(''); setRenaming(true); setProjectMenuOpen(false) }}>Projektnamen ändern</TooltipMenuButton>
                </TooltipMenu>}
              </div>}
            </header>
            <nav className="audiobook-project-nav" aria-label="Projektansichten">
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}`} aria-current={!isExercise ? 'page' : undefined}>Edit</Link>
              <Link className="audiobook-project-tab" to={`/audiobook/${encodeURIComponent(projectId)}/exercise`} aria-current={isExercise ? 'page' : undefined}>Exercise</Link>
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
        {projects === null ? (
          !error && <p>Lade Projekte ...</p>
        ) : projectId ? (
          project ? (
            <ProjectTracks key={project.id} projectId={project.id} readOnly={isExercise} />
          ) : (
            <p>Dieses Projekt wurde nicht gefunden.</p>
          )
        ) : (
          <>
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

            <section className="audiobook-projects" aria-labelledby="audiobook-projects-title">
              <h2 id="audiobook-projects-title">Deine Projekte</h2>
              {projects.length === 0 ? (
                <p className="audiobook-empty">Noch keine Projekte vorhanden. Füge dein erstes Lied oder deine erste Aufnahme hinzu.</p>
              ) : (
                <ul className="audiobook-list">
                  {projects.map((item) => (
                    <li className="audiobook-project" key={item.id}>
                      <Link className="audiobook-project-link" to={`/audiobook/${item.id}`}>
                        <span>{item.name}</span>
                        <span className="audiobook-open">Öffnen →</span>
                      </Link>
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
                      ) : (
                        <button type="button" className="audiobook-delete" aria-label={`${item.name} löschen`} disabled={busy} onClick={() => setDeleteId(item.id)}>
                          Löschen
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
