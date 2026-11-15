import { useState } from 'react'
import type { AudiobookProject } from './storage'
import { exportProjectArchive } from './projectArchive'
import { exportProjectMp3 } from './projectMp3'

export function ProjectExport({ project }: { project: AudiobookProject }) {
  const [format, setFormat] = useState<'mp3' | 'vst'>('mp3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setBusy(true)
    setError('')
    try {
      const blob = format === 'mp3' ? await exportProjectMp3(project.id) : await exportProjectArchive(project)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.${format}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (cause) {
      setError(`Export fehlgeschlagen: ${cause instanceof Error ? cause.message : 'Unbekannter Fehler.'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="audiobook-details" aria-labelledby="project-export-title">
      <div className="audiobook-details-card">
        <h2 id="project-export-title">Projekt exportieren</h2>
        <label htmlFor="project-export-format">Dateityp</label>
        <select id="project-export-format" value={format} disabled={busy} onChange={(event) => setFormat(event.target.value === 'vst' ? 'vst' : 'mp3')}>
          <option value="mp3">MP3 – abgemischtes Lied</option>
          <option value="vst">Projektdatei (.vst)</option>
        </select>
        <p>{format === 'mp3' ? 'Exportiert den aktuellen Mix einschließlich Lautstärke und Stummschaltung. Der Encoder wird bei Bedarf vom Server geladen.' : 'Enthält Spuren, Audiodateien, Liedtexte und PDFs zum späteren Import.'}</p>
        <div className="audiobook-details-actions">
          <button className="audiobook-primary" type="button" disabled={busy} onClick={() => void download()}>{busy ? 'Export läuft ...' : 'Exportieren'}</button>
        </div>
        {busy && <p role="status">Die Datei wird erstellt. Das kann bei großen Projekten dauern.</p>}
        {error && <p className="audiobook-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}
