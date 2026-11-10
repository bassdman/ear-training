import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { createProjectId, readProjects, writeProjects, type AudiobookProject } from './storage'
import { deleteProjectTracks } from './audioStorage'
import { ProjectTracks } from './ProjectTracks'
import './audiobookPage.css'

export function AudiobookPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<AudiobookProject[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  const project = projects?.find((item) => item.id === projectId)

  return (
    <main className="audiobook-page">
      <div className="audiobook-shell">
        <Link className="audiobook-back" to={projectId ? '/audiobook' : '/'}>
          {projectId ? 'Zurück zum Audiobook' : 'Zur Startseite'}
        </Link>
        <header className="audiobook-header">
          <p className="audiobook-kicker">Songstudio</p>
          <h1>{projectId ? (project?.name ?? 'Projekt') : 'Audiobook'}</h1>
          {!projectId && <p>Hier verwaltest du deine Lieder und Aufnahmen als Projekte.</p>}
        </header>

        {error && <p className="audiobook-error" role="alert">{error}</p>}
        {projects === null ? (
          !error && <p>Lade Projekte ...</p>
        ) : projectId ? (
          project ? (
            <ProjectTracks key={project.id} projectId={project.id} />
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
