import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudiobookPage } from './AudiobookPage'
import { AUDIOBOOK_STORAGE_KEY } from './storage'

function renderAudiobook(path = '/audiobook') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/audiobook/:projectId?" element={<AudiobookPage />} />
        <Route path="/" element={<p>Startseite</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Audiobook', () => {
  beforeEach(() => localStorage.removeItem(AUDIOBOOK_STORAGE_KEY))
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
  })

  it('legt Projekte an, öffnet sie und bewahrt sie nach erneutem Laden', async () => {
    const view = renderAudiobook()
    expect(await screen.findByText(/Noch keine Projekte/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Projektname'), { target: { value: '  Mein Lied  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Projekt hinzufügen' }))
    const link = await screen.findByRole('link', { name: /Mein Lied.*Öffnen/ })
    const projectPath = link.getAttribute('href')
    fireEvent.click(link)
    expect(screen.getByRole('heading', { name: 'Mein Lied' })).toBeInTheDocument()
    expect(screen.getByText('Spur 1')).toBeInTheDocument()
    expect(screen.getByText('Neues Audio hinzufügen')).toBeInTheDocument()

    view.unmount()
    renderAudiobook(projectPath ?? '')
    expect(await screen.findByRole('heading', { name: 'Mein Lied' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Zurück zum Audiobook' }))
    expect(screen.getByRole('link', { name: /Mein Lied.*Öffnen/ })).toBeInTheDocument()
  })

  it('löscht nur das bestätigte Projekt und behält andere Projekte', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([
      { id: 'one', name: 'Erstes Lied' },
      { id: 'two', name: 'Zweites Lied' },
    ]))
    renderAudiobook()
    fireEvent.click(await screen.findByRole('button', { name: 'Erstes Lied löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('link', { name: /Erstes Lied/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erstes Lied löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /Erstes Lied/ })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Zweites Lied/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(AUDIOBOOK_STORAGE_KEY) ?? '')).toEqual([{ id: 'two', name: 'Zweites Lied' }])
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
