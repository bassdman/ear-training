import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as storage from './audioStorage'
import { ProjectDetails } from './ProjectDetails'

const projects: string[] = []
function project() {
  const id = crypto.randomUUID()
  projects.push(id)
  return id
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await Promise.all(projects.splice(0).map((id) => storage.deleteProjectTracks(id)))
})

describe('Lyrics und Dokumente', () => {
  it('zeigt den vollständigen Liedtext und speichert schnelle Änderungen in der richtigen Reihenfolge', async () => {
    const id = project()
    const track = await storage.addEmptyTrack(id, 'vocal')
    const fullText = Array.from({ length: 30 }, (_, index) => `Zeile ${index + 1}`).join('\n')
    await storage.saveProjectLyrics({ id: 'lyrics', projectId: id, text: fullText, trackId: null, createdAt: 1 })
    const originalSave = storage.saveProjectLyrics
    let release: () => void = () => { throw new Error('Speicherung nicht gestartet') }
    const save = vi.spyOn(storage, 'saveProjectLyrics').mockImplementationOnce(async (entry) => {
      await new Promise<void>((resolve) => { release = resolve })
      await originalSave(entry)
    })
    render(<ProjectDetails projectId={id} />)
    const textView = await screen.findByText((_, element) => element?.className === 'audiobook-lyrics-text')
    expect(textView.textContent).toBe(fullText)
    expect(screen.queryByRole('textbox', { name: 'Liedtext' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Liedtext'), { target: { value: 'Erste Änderung' } })
    fireEvent.change(screen.getByLabelText('Liedtext'), { target: { value: 'Letzte Änderung\nZweite Zeile' } })
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spur zuordnen' }))
    fireEvent.change(screen.getByLabelText('Vocalspur'), { target: { value: track.id } })
    expect(save).toHaveBeenCalledTimes(1)
    release()
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toMatchObject([{ text: 'Letzte Änderung\nZweite Zeile', trackId: track.id }]))
    expect(save).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeitung beenden' }))
    expect(screen.getByText((_, element) => element?.className === 'audiobook-lyrics-text').textContent).toBe('Letzte Änderung\nZweite Zeile')
  })

  it('meldet Speicherfehler, behält den Text und ermöglicht einen erneuten Versuch', async () => {
    const id = project()
    await storage.saveProjectLyrics({ id: 'lyrics', projectId: id, text: 'Alt', trackId: null, createdAt: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(storage, 'saveProjectLyrics').mockRejectedValueOnce(new Error('Speicher voll'))
    render(<ProjectDetails projectId={id} />)
    await screen.findByText('Alt')
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Liedtext'), { target: { value: 'Ungesicherter Text' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Speicher voll')
    expect(screen.getByLabelText('Liedtext')).toHaveValue('Ungesicherter Text')
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toMatchObject([{ text: 'Ungesicherter Text' }]))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('speichert bereits eingegebene Änderungen auch nach dem Verlassen weiter', async () => {
    const id = project()
    await storage.saveProjectLyrics({ id: 'lyrics', projectId: id, text: 'Alt', trackId: null, createdAt: 1 })
    const originalSave = storage.saveProjectLyrics
    let release: () => void = () => { throw new Error('Speicherung nicht gestartet') }
    vi.spyOn(storage, 'saveProjectLyrics').mockImplementationOnce(async (entry) => {
      await new Promise<void>((resolve) => { release = resolve })
      await originalSave(entry)
    })
    const view = render(<ProjectDetails projectId={id} />)
    await screen.findByText('Alt')
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Liedtext'), { target: { value: 'Erster Text' } })
    fireEvent.change(screen.getByLabelText('Liedtext'), { target: { value: 'Letzter Text' } })
    view.unmount()
    release()
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toMatchObject([{ text: 'Letzter Text' }]))
  })

  it('speichert mehrere Texte und PDFs, ordnet Vocalspuren zu und erhält alles beim Neuladen', async () => {
    const id = project()
    const vocal = await storage.addEmptyTrack(id, 'vocal')
    await storage.addEmptyTrack(id, 'instrumental')
    const view = render(<ProjectDetails projectId={id} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Liedtext hinzufügen' }))
    const text = await screen.findByLabelText('Liedtext')
    fireEvent.change(text, { target: { value: 'Erste Strophe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spur zuordnen' }))
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Vocalspur'), { target: { value: vocal.id } })
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toMatchObject([{ text: 'Erste Strophe', trackId: vocal.id }]))
    fireEvent.click(screen.getByRole('button', { name: 'Liedtext hinzufügen' }))
    await waitFor(() => expect(screen.getAllByLabelText('Liedtext')).toHaveLength(2))
    fireEvent.change(screen.getAllByLabelText('Liedtext')[1], { target: { value: 'Zweite Strophe' } })
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toMatchObject([{ text: 'Erste Strophe' }, { text: 'Zweite Strophe' }]))

    for (const name of ['Noten', 'Akkorde']) {
      const form = screen.getByRole('button', { name: 'PDF hinzufügen' }).closest('form')
      if (!form) throw new Error('PDF-Formular fehlt')
      fireEvent.change(within(form).getByLabelText('Name'), { target: { value: name } })
      fireEvent.change(within(form).getByLabelText('Beschreibung (optional)'), { target: { value: `${name} Beschreibung` } })
      fireEvent.change(within(form).getByLabelText('PDF-Datei'), { target: { files: [new File(['%PDF-1.7\n'], `${name}.pdf`, { type: 'application/pdf' })] } })
      fireEvent.submit(form)
      await waitFor(async () => expect((await storage.readProjectDocuments(id)).some((doc) => doc.name === name)).toBe(true))
    }

    view.unmount()
    render(<ProjectDetails projectId={id} />)
    expect(await screen.findByText('Erste Strophe')).toBeInTheDocument()
    expect(screen.getByText('Zweite Strophe')).toBeInTheDocument()
    expect(screen.getByText(/Vocalspur: Spur \d/)).toBeInTheDocument()
    expect(screen.getByText('Keine Vocalspur zugewiesen')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Noten Beschreibung')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Akkorde Beschreibung')).toBeInTheDocument()
  }, 20000)

  it('bearbeitet und löscht Dokumente und Liedtexte nach Bestätigung', async () => {
    const id = project()
    await storage.saveProjectLyrics({ id: 'lyrics', projectId: id, text: 'Text', trackId: null, createdAt: 1 })
    await storage.saveProjectDocument({ id: 'doc', projectId: id, name: 'Noten', description: '', pdf: new Blob(['%PDF-1.7']), createdAt: 1 })
    render(<ProjectDetails projectId={id} />)
    const documentForm = (await screen.findByDisplayValue('Noten')).closest('form')
    if (!documentForm) throw new Error('Dokumentformular fehlt')
    fireEvent.change(within(documentForm).getByLabelText('Name'), { target: { value: 'Neue Noten' } })
    fireEvent.change(within(documentForm).getByLabelText('Beschreibung (optional)'), { target: { value: 'Info' } })
    fireEvent.click(within(documentForm).getByRole('button', { name: 'Dokument speichern' }))
    await screen.findByText('Dokument gespeichert.')
    expect(await storage.readProjectDocuments(id)).toMatchObject([{ name: 'Neue Noten', description: 'Info' }])
    fireEvent.click(within(documentForm).getByRole('button', { name: 'Dokument löschen' }))
    fireEvent.click(within(documentForm).getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(async () => expect(await storage.readProjectDocuments(id)).toEqual([]))
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Liedtext' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(async () => expect(await storage.readProjectLyrics(id)).toEqual([]))
  })

  it('weist ungültige Dateien ab und meldet fehlgeschlagene Speicherung und blockierte PDFs', async () => {
    const id = project()
    await storage.saveProjectDocument({ id: 'doc', projectId: id, name: 'Noten', description: '', pdf: new Blob(['%PDF-1.7']), createdAt: 1 })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ProjectDetails projectId={id} />)
    fireEvent.click(await screen.findByRole('button', { name: 'PDF öffnen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pop-ups')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')

    const form = screen.getByRole('button', { name: 'PDF hinzufügen' }).closest('form')
    if (!form) throw new Error('PDF-Formular fehlt')
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Kein PDF' } })
    fireEvent.change(within(form).getByLabelText('PDF-Datei'), { target: { files: [new File(['kein PDF'], 'bad.pdf', { type: 'application/pdf' })] } })
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('gültige PDF-Datei'))
    expect(await storage.readProjectDocuments(id)).toHaveLength(1)

    vi.spyOn(storage, 'saveProjectLyrics').mockRejectedValue(new Error('Speicher voll'))
    fireEvent.click(screen.getByRole('button', { name: 'Liedtext hinzufügen' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Speicher voll'))
    expect(await storage.readProjectLyrics(id)).toEqual([])
  })

  it('öffnet PDFs in einem neuen Fenster und gibt die Objekt-URL beim Verlassen frei', async () => {
    const id = project()
    await storage.saveProjectDocument({ id: 'open-doc', projectId: id, name: 'Noten', description: '', pdf: new Blob(['%PDF-1.7']), createdAt: 1 })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:document'), revokeObjectURL: vi.fn() })
    const opened = { opener: window } as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(opened)
    const view = render(<ProjectDetails projectId={id} />)
    fireEvent.click(await screen.findByRole('button', { name: 'PDF öffnen' }))
    expect(open).toHaveBeenCalledWith('blob:document', '_blank')
    expect(opened.opener).toBeNull()
    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:document')
  })

  it('entkoppelt Texte bei Spurlöschung und löscht nur die Daten des ausgewählten Projekts', async () => {
    const first = project()
    const second = project()
    const vocal = await storage.addEmptyTrack(first, 'vocal')
    await storage.saveProjectLyrics({ id: 'first-lyrics', projectId: first, text: 'Bleibt', trackId: vocal.id, createdAt: 1 })
    await storage.saveProjectLyrics({ id: 'second-lyrics', projectId: second, text: 'Anderes', trackId: null, createdAt: 1 })
    await storage.saveProjectDocument({ id: 'first-doc', projectId: first, name: 'Erstes', description: '', pdf: new Blob(['%PDF-1.7']), createdAt: 1 })
    await storage.saveProjectDocument({ id: 'second-doc', projectId: second, name: 'Zweites', description: '', pdf: new Blob(['%PDF-1.7']), createdAt: 1 })
    await storage.deleteTrack(vocal.id)
    expect(await storage.readProjectLyrics(first)).toMatchObject([{ text: 'Bleibt', trackId: null }])
    await expect(storage.saveProjectLyrics({ id: 'stale', projectId: first, text: '', trackId: vocal.id, createdAt: 2 })).rejects.toThrow('Vocalspur nicht gefunden')
    await storage.deleteProjectTracks(first)
    expect(await storage.readProjectLyrics(first)).toEqual([])
    expect(await storage.readProjectDocuments(first)).toEqual([])
    expect(await storage.readProjectLyrics(second)).toHaveLength(1)
    expect(await storage.readProjectDocuments(second)).toHaveLength(1)
  })
})
