import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudiobookPage } from './AudiobookPage'
import { AUDIOBOOK_STORAGE_KEY } from './storage'
import { addTrack, readTracks } from './audioStorage'
import * as audioStorage from './audioStorage'

function renderAudiobook(path = '/audiobook') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/audiobook/:projectId?" element={<AudiobookPage />}>
          <Route path="exercise" element={null} />
        </Route>
        <Route path="/" element={<p>Startseite</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Audiobook', () => {
  beforeEach(() => {
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
  })

  it('zeigt den Debug-Trace im Projektmenü nur im Übungsmodus und deaktiviert ihn ohne Vocalspur', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'trace-song', name: 'Trace' }]))
    vi.spyOn(audioStorage, 'readTracks').mockResolvedValue([])
    renderAudiobook('/audiobook/trace-song/exercise')
    await screen.findByRole('region', { name: 'Stimmgerät zum Üben' }, { timeout: 10000 })
    fireEvent.click(screen.getByRole('button', { name: 'Projektoptionen' }))
    expect(await screen.findByRole('button', { name: 'Debug-Trace herunterladen' }, { timeout: 10000 })).toBeDisabled()
    fireEvent.click(screen.getByRole('link', { name: 'Edit' }))
    expect(screen.queryByRole('button', { name: 'Debug-Trace herunterladen' })).not.toBeInTheDocument()
  }, 15000)

  it('legt Projekte an, öffnet sie und bewahrt sie nach erneutem Laden', async () => {
    const view = renderAudiobook()
    expect(await screen.findByText(/Noch keine Projekte/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Projektname'), { target: { value: '  Mein Lied  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Projekt hinzufügen' }))
    const link = await screen.findByRole('link', { name: 'Mein Lied bearbeiten' })
    const projectPath = link.getAttribute('href')
    fireEvent.click(link)
    expect(screen.getByRole('heading', { name: 'Mein Lied' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Mixed-Spur' })).toBeInTheDocument()

    view.unmount()
    renderAudiobook(projectPath ?? '')
    expect(await screen.findByRole('heading', { name: 'Mein Lied' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Zurück zum Audiobook' }))
    expect(screen.getByRole('link', { name: 'Mein Lied bearbeiten' })).toBeInTheDocument()
  }, 15000)

  it('zeigt Projekte vor dem Formular und verlinkt direkt zu beiden Ansichten', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'song 1', name: 'Mein Lied' }, { id: 'song2', name: 'Anderes Lied' }]))
    const view = renderAudiobook()
    const edit = await screen.findByRole('link', { name: 'Mein Lied bearbeiten' })
    const exercise = screen.getByRole('link', { name: 'Mein Lied üben' })
    expect(edit).toHaveAttribute('href', '/audiobook/song%201')
    expect(exercise).toHaveAttribute('href', '/audiobook/song%201/exercise')
    expect(screen.getByRole('region', { name: 'Deine Projekte' }).compareDocumentPosition(screen.getByLabelText('Projektname')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Projekt löschen' })).not.toBeInTheDocument()
    const first = screen.getByRole('button', { name: 'Optionen für Mein Lied' })
    const second = screen.getByRole('button', { name: 'Optionen für Anderes Lied' })
    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Projekt löschen' })).toHaveClass('audiobook-list-delete')
    fireEvent.click(second)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(second).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Projekt löschen' })).not.toBeInTheDocument()
    fireEvent.click(exercise)
    expect(await screen.findByRole('link', { name: 'Exercise' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Mein Lied' })).toBeInTheDocument()
    view.unmount()
  }, 15000)

  it('navigiert zwischen Editor, Übungsansicht und Projektliste und unterstützt direkte Übungslinks', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'song', name: 'Mein Lied' }]))
    const readTracksSpy = vi.spyOn(audioStorage, 'readTracks')
    const view = renderAudiobook('/audiobook/song')
    expect(await screen.findByRole('button', { name: 'Mixed-Spur' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Exercise' })).toHaveAttribute('href', '/audiobook/song/exercise')
    fireEvent.click(screen.getByRole('link', { name: 'Exercise' }))
    expect(screen.getByRole('link', { name: 'Exercise' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('region', { name: 'Stimmgerät zum Üben' })).toBeInTheDocument()
    expect(await screen.findByText(/Noch keine Spuren vorhanden/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mixed-Spur' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Edit' }))
    expect(await screen.findByRole('button', { name: 'Mixed-Spur' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mixed-Spur' }))
    expect(await screen.findByRole('button', { name: 'Freier Bereich in Spur 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Exercise' }))
    expect(screen.queryByRole('region', { name: 'Gemeinsame Zeitleiste' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Freier Bereich in Spur 1' })).not.toBeInTheDocument()
    expect(readTracksSpy).toHaveBeenCalledTimes(1)
    expect(await readTracks('song')).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'Zurück zum Audiobook' }))
    expect(await screen.findByRole('link', { name: 'Mein Lied bearbeiten' })).toBeInTheDocument()
    view.unmount()
    renderAudiobook('/audiobook/song/exercise')
    expect(await screen.findByRole('region', { name: 'Stimmgerät zum Üben' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exercise' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/audiobook/song')
    expect(screen.queryByRole('region', { name: 'Gemeinsame Zeitleiste' })).not.toBeInTheDocument()
    await audioStorage.deleteProjectTracks('song')
  }, 15000)

  it('benennt ein Projekt im Menü um und behält Spuren, Adresse und andere Projekte', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'song', name: 'Alter Name' }, { id: 'other', name: 'Anderes Lied' }]))
    await audioStorage.addEmptyTrack('song')
    const view = renderAudiobook('/audiobook/song/exercise')
    expect(await screen.findByRole('heading', { name: 'Alter Name' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Projektoptionen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projektnamen ändern' }))
    const input = screen.getByLabelText('Projektname')
    expect(input).toHaveValue('Alter Name')
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: '  Neuer Name  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('heading', { name: 'Neuer Name' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exercise' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/audiobook/song')
    expect(await readTracks('song')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(AUDIOBOOK_STORAGE_KEY) ?? '')).toEqual([{ id: 'song', name: 'Neuer Name' }, { id: 'other', name: 'Anderes Lied' }])
    view.unmount()
    renderAudiobook('/audiobook/song')
    expect(await screen.findByRole('heading', { name: 'Neuer Name' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Zurück zum Audiobook' }))
    expect(await screen.findByRole('link', { name: 'Neuer Name bearbeiten' })).toBeInTheDocument()
    await audioStorage.deleteProjectTracks('song')
  }, 15000)

  it('validiert Namen, erlaubt Abbrechen und meldet Speicherfehler ohne Datenverlust', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'song', name: 'Alter Name' }]))
    renderAudiobook('/audiobook/song')
    expect(await screen.findByRole('heading', { name: 'Alter Name' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Projektoptionen' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Projektnamen ändern' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Projektoptionen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projektnamen ändern' }))
    fireEvent.change(screen.getByLabelText('Projektname'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte gib einen Projektnamen ein')
    fireEvent.change(screen.getByLabelText('Projektname'), { target: { value: 'Neuer Name' } })
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Speicher voll') })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Projektname konnte nicht gespeichert werden')
    expect(screen.getByRole('heading', { name: 'Alter Name' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(AUDIOBOOK_STORAGE_KEY) ?? '')).toEqual([{ id: 'song', name: 'Alter Name' }])
    failure.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByLabelText('Projektname')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Projektoptionen' })).toHaveFocus()
  })

  it('löscht nur das bestätigte Projekt und seine Audiospuren', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([
      { id: 'one', name: 'Erstes Lied' },
      { id: 'two', name: 'Zweites Lied' },
    ]))
    await addTrack('one', new File(['a'], 'a.mp3', { type: 'audio/mpeg' }))
    await addTrack('two', new File(['b'], 'b.mp3', { type: 'audio/mpeg' }))
    renderAudiobook()
    fireEvent.click(await screen.findByRole('button', { name: 'Optionen für Erstes Lied' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projekt löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('link', { name: 'Erstes Lied bearbeiten' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Optionen für Erstes Lied' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projekt löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Erstes Lied bearbeiten' })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Zweites Lied bearbeiten' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(AUDIOBOOK_STORAGE_KEY) ?? '')).toEqual([{ id: 'two', name: 'Zweites Lied' }])
    expect(await readTracks('one')).toEqual([])
    expect(await readTracks('two')).toHaveLength(1)
    await audioStorage.deleteProjectTracks('two')
  })

  it('behält das Projekt, wenn die Audiodaten nicht gelöscht werden können', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'one', name: 'Lied' }]))
    vi.spyOn(audioStorage, 'deleteProjectTracks').mockRejectedValue(new Error('Datenbankfehler'))
    renderAudiobook()
    fireEvent.click(await screen.findByRole('button', { name: 'Optionen für Lied' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projekt löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Projekt wurde beibehalten')
    expect(screen.getByRole('link', { name: 'Lied bearbeiten' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(AUDIOBOOK_STORAGE_KEY) ?? '')).toEqual([{ id: 'one', name: 'Lied' }])
  })

  it('weist leere Namen ab', async () => {
    renderAudiobook()
    fireEvent.change(await screen.findByLabelText('Projektname'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Projekt hinzufügen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte gib einen Projektnamen ein.')
    expect(localStorage.getItem(AUDIOBOOK_STORAGE_KEY)).toBeNull()
  })

  it('meldet beschädigte Daten, ohne sie zu überschreiben', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, 'beschädigt')
    renderAudiobook()
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Projekte konnten nicht geladen werden')
    expect(screen.queryByRole('button', { name: 'Projekt hinzufügen' })).not.toBeInTheDocument()
    expect(localStorage.getItem(AUDIOBOOK_STORAGE_KEY)).toBe('beschädigt')
  })

  it('meldet Speicherfehler, ohne ein Projekt als gespeichert anzuzeigen', async () => {
    renderAudiobook()
    fireEvent.change(await screen.findByLabelText('Projektname'), { target: { value: 'Lied' } })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Speicher voll') })
    fireEvent.click(screen.getByRole('button', { name: 'Projekt hinzufügen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Projekt konnte nicht gespeichert werden')
    expect(within(screen.getByRole('region', { name: 'Deine Projekte' })).queryByText('Lied')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Projektname')).toHaveValue('Lied')
  })

  it('zeigt einen Hinweis für unbekannte Projekte', async () => {
    renderAudiobook('/audiobook/unbekannt')
    expect(await screen.findByText('Dieses Projekt wurde nicht gefunden.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zurück zum Audiobook' })).toHaveAttribute('href', '/audiobook')
  })
})
