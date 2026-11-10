import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as audioStorage from './audioStorage'
import { ProjectTracks } from './ProjectTracks'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

beforeEach(() => {
  class TestURL extends URL {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  }
  vi.stubGlobal('URL', TestURL)
  createObjectURL.mockReset().mockReturnValue('blob:test-audio')
  revokeObjectURL.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ProjectTracks', () => {
  it('speichert mehrere Spuren, stellt sie nach erneutem Öffnen wieder her und gibt sie zur Wiedergabe frei', async () => {
    const projectId = crypto.randomUUID()
    const view = render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    const first = new File(['first'], 'gesang.mp3', { type: 'audio/mpeg' })
    fireEvent.change(input, { target: { files: [first] } })
    const player = await screen.findByLabelText('gesang.mp3 abspielen')
    expect(player).toHaveAttribute('src', 'blob:test-audio')
    expect(player).toHaveAttribute('controls')
    expect(createObjectURL).toHaveBeenCalledWith(first)

    const second = new File(['second'], 'klavier.wav', { type: 'audio/wav' })
    fireEvent.change(screen.getByLabelText('Neues Audio hinzufügen'), { target: { files: [second] } })
    expect(await screen.findByLabelText('klavier.wav abspielen')).toBeInTheDocument()
    expect(screen.getByText('Spur 3')).toBeInTheDocument()
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)

    render(<ProjectTracks projectId={projectId} />)
    expect(await screen.findByLabelText('gesang.mp3 abspielen')).toBeInTheDocument()
    expect(screen.getByLabelText('klavier.wav abspielen')).toBeInTheDocument()
    expect((await audioStorage.readTracks(projectId)).map((track) => track.name).sort()).toEqual(['gesang.mp3', 'klavier.wav'])
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('trennt und löscht Audiodaten je Projekt', async () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    await audioStorage.addTrack(firstId, new File(['a'], 'a.mp3', { type: 'audio/mpeg' }))
    await audioStorage.addTrack(secondId, new File(['b'], 'b.mp3', { type: 'audio/mpeg' }))
    await audioStorage.deleteProjectTracks(firstId)
    expect(await audioStorage.readTracks(firstId)).toEqual([])
    expect(await audioStorage.readTracks(secondId)).toHaveLength(1)
    await audioStorage.deleteProjectTracks(secondId)
  })

  it('meldet Speicherfehler und zeigt keine ungespeicherte Spur', async () => {
    vi.spyOn(audioStorage, 'addTrack').mockRejectedValue(new Error('Speicher voll'))
    render(<ProjectTracks projectId={crypto.randomUUID()} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    fireEvent.change(input, { target: { files: [new File(['a'], 'test.mp3', { type: 'audio/mpeg' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden')
    expect(screen.queryByLabelText('test.mp3 abspielen')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Neues Audio hinzufügen')).toBeEnabled()
  })

  it('weist leere und ungeeignete Dateien ab und meldet Wiedergabefehler', async () => {
    const projectId = crypto.randomUUID()
    render(<ProjectTracks projectId={projectId} />)
    const input = await screen.findByLabelText('Neues Audio hinzufügen')
    fireEvent.change(input, { target: { files: [new File([], 'leer.mp3', { type: 'audio/mpeg' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('ist leer')
    fireEvent.change(input, { target: { files: [new File(['text'], 'text.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Audiodatei')
    fireEvent.change(input, { target: { files: [new File(['a'], 'ton.mp3', { type: 'audio/mpeg' })] } })
    const player = await screen.findByLabelText('ton.mp3 abspielen')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    fireEvent.error(player)
    expect(screen.getByRole('alert')).toHaveTextContent('nicht abgespielt werden')
    await audioStorage.deleteProjectTracks(projectId)
  })

  it('meldet Fehler beim Laden', async () => {
    vi.spyOn(audioStorage, 'readTracks').mockRejectedValue(new Error('Datenbankfehler'))
    render(<ProjectTracks projectId={crypto.randomUUID()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen werden')
    expect(screen.queryByLabelText('Neues Audio hinzufügen')).not.toBeInTheDocument()
  })
})
