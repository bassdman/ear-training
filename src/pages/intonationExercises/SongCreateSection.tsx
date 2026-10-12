import { useState, type FormEvent } from 'react'

import { formatNote } from '../../features/intonationPractice/notes'
import {
  BEATS_PER_MINUTE_RANGE,
  DEFAULT_BEATS_PER_MINUTE,
  formatSongLine,
  isValidBeatsPerMinute,
} from '../../features/intonationPractice/songs'
import { loadAllSongs, resetSongOverride, saveSong } from '../../features/intonationPractice/storage'
import { downloadSong } from '../../features/intonationPractice/songExport'
import type { Song, SongNote, SongNoteValue } from '../../features/intonationPractice/types'
import { DEFAULT_SONGS } from '../../features/intonationPractice/defaultSongs'

const GRID_COLUMNS = 8
const NOTE_VALUES: { value: SongNoteValue; label: string; eighths: number }[] = [
  { value: 'whole', label: 'Ganz (1)', eighths: 8 },
  { value: 'half', label: 'Halb (2)', eighths: 4 },
  { value: 'quarter', label: 'Viertel (4)', eighths: 2 },
  { value: 'eighth', label: 'Achtel (8)', eighths: 1 },
]
const PITCH_OPTIONS = Array.from({ length: 49 }, (_, index) => index + 48)

type SelectedNote = { measure: number; index: number }

function noteEighths(note: SongNote): number {
  return NOTE_VALUES.find((entry) => entry.value === (note.duration ?? 'quarter'))?.eighths ?? 2
}

function measureLength(notes: readonly SongNote[]): number {
  return notes.reduce((length, note) => length + noteEighths(note), 0)
}

function measureCapacity(notes: readonly SongNote[]): number {
  return Math.max(GRID_COLUMNS, Math.ceil(measureLength(notes) / GRID_COLUMNS) * GRID_COLUMNS)
}

function noteAtSlot(notes: readonly SongNote[], slot: number) {
  let offset = 0
  for (const [index, note] of notes.entries()) {
    const end = offset + noteEighths(note)
    if (slot >= offset && slot < end) return { note, index, innerOffset: slot - offset }
    offset = end
  }
  return null
}

function noteTexts(note: SongNote): string[] {
  return note.textParts ?? Array.from({ length: noteEighths(note) }, (_, index) =>
    index === 0 ? note.text : '',
  )
}

export function SongCreateSection() {
  const [songs, setSongs] = useState<Song[]>(() => {
    const loadedSongs = loadAllSongs()
    console.info('[SongEditor] Songliste geladen', {
      count: loadedSongs.length,
      songIds: loadedSongs.map((song) => song.id),
    })
    return loadedSongs
  })
  const [editingSongId, setEditingSongId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [beatsPerMinute, setBeatsPerMinute] = useState(DEFAULT_BEATS_PER_MINUTE)
  const [measures, setMeasures] = useState<SongNote[][]>([[]])
  const [selected, setSelected] = useState<SelectedNote | null>(null)
  const [pitch, setPitch] = useState(60)
  const [duration, setDuration] = useState<SongNoteValue>('quarter')
  const [entryKind, setEntryKind] = useState<'note' | 'rest'>('note')
  const [error, setError] = useState<string | null>(null)

  const startEditing = (song: Song) => {
    console.info('[SongEditor] Öffnen angefordert', {
      id: song.id,
      name: song.name,
      lineCount: Array.isArray(song.lines) ? song.lines.length : null,
    })

    try {
      if (!Array.isArray(song.lines)) throw new Error('Die Liedzeilen fehlen oder sind ungültig.')

      for (const [lineIndex, line] of song.lines.entries()) {
        if (!Array.isArray(line)) {
          throw new Error(`Zeile ${lineIndex + 1} ist keine gültige Notenliste.`)
        }
        for (const [entryIndex, entry] of line.entries()) {
          if (
            entry.note !== null &&
            (!Number.isInteger(entry.note) || entry.note < 0 || entry.note > 127)
          ) {
            throw new Error(
              `Zeile ${lineIndex + 1}, Eintrag ${entryIndex + 1}: ${entry.note} ist keine gültige MIDI-Tonhöhe (ganze Zahl von 0 bis 127).`,
            )
          }
          if (entry.textParts !== undefined && !entry.textParts.every((part) => typeof part === 'string')) {
            throw new Error(
              `Zeile ${lineIndex + 1}, Eintrag ${entryIndex + 1}: Die Textteile sind ungültig.`,
            )
          }
          if (entry.duration !== undefined && !NOTE_VALUES.some((value) => value.value === entry.duration)) {
            throw new Error(
              `Zeile ${lineIndex + 1}, Eintrag ${entryIndex + 1}: Der Notenwert „${entry.duration}“ wird nicht unterstützt.`,
            )
          }
        }
      }

      const editableLines = song.lines.length > 0
        ? song.lines.map((line) => line.map((note) => ({ ...note, textParts: note.textParts?.slice() })))
        : [[]]

      setEditingSongId(song.id)
      setName(song.name)
      setBeatsPerMinute(song.beatsPerMinute ?? DEFAULT_BEATS_PER_MINUTE)
      setMeasures(editableLines)
      setSelected(null)
      setEntryKind('note')
      setError(null)
      console.info('[SongEditor] Lied geöffnet', {
        id: song.id,
        lineCount: song.lines.length,
        entryCount: song.lines.reduce((count, line) => count + line.length, 0),
      })
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      console.error('[SongEditor] Lied konnte nicht geöffnet werden', {
        id: song.id,
        name: song.name,
        reason,
      })
      setError(`„${song.name}“ kann nicht geöffnet werden. ${reason}`)
    }
  }

  const clearEditor = () => {
    setEditingSongId(null)
    setName('')
    setBeatsPerMinute(DEFAULT_BEATS_PER_MINUTE)
    setMeasures([[]])
    setSelected(null)
    setError(null)
  }

  const handleResetSong = (song: Song) => {
    resetSongOverride(song.id)
    setSongs(loadAllSongs())
    const defaultSong = DEFAULT_SONGS.find((entry) => entry.id === song.id)
    if (editingSongId === song.id && defaultSong) startEditing(defaultSong)
  }

  const selectedEntry = selected ? measures[selected.measure]?.[selected.index] : undefined
  const availablePitches = Array.from(
    new Set([
      ...PITCH_OPTIONS,
      ...measures.flatMap((line) =>
        line.flatMap((entry) => (entry.note === null ? [] : [entry.note])),
      ),
    ]),
  ).sort((pitchA, pitchB) => pitchA - pitchB)

  const updateSelected = (updateNote: (note: SongNote) => SongNote) => {
    if (!selected) return
    setMeasures((current) =>
      current.map((line, measureIndex) =>
        measureIndex === selected.measure
          ? line.map((note, noteIndex) => (noteIndex === selected.index ? updateNote(note) : note))
          : line,
      ),
    )
  }

  const handlePitchChange = (nextPitch: number) => {
    setPitch(nextPitch)
    if (selectedEntry) updateSelected((note) => ({ ...note, note: nextPitch }))
  }

  const handleDurationChange = (nextDuration: SongNoteValue) => {
    setDuration(nextDuration)
    if (!selected) return
    const line = measures[selected.measure]
    const currentLength = measureLength(line) - noteEighths(line[selected.index])
    const nextNoteLength = NOTE_VALUES.find((entry) => entry.value === nextDuration)?.eighths ?? 2
    if (currentLength + nextNoteLength > measureCapacity(line)) {
      setError('Diese Note passt mit der gewählten Länge nicht mehr in den Takt.')
      return
    }
    updateSelected((note) => ({ ...note, duration: nextDuration }))
    setError(null)
  }

  const addEntry = (measureIndex: number, slot: number) => {
    const line = measures[measureIndex]
    const currentLength = measureLength(line)
    const selectedLength = NOTE_VALUES.find((entry) => entry.value === duration)?.eighths ?? 2
    if (slot < currentLength || slot + selectedLength > measureCapacity(line)) {
      setError('Die Note passt an dieser Stelle nicht in den Takt.')
      return
    }

    let padding = slot - currentLength
    const rests: SongNote[] = []
    for (const restLength of [4, 2, 1]) {
      while (padding >= restLength) {
        rests.push({
          note: null,
          text: '',
          duration: NOTE_VALUES.find((entry) => entry.eighths === restLength)?.value,
        })
        padding -= restLength
      }
    }
    const newEntry: SongNote = {
      note: entryKind === 'rest' ? null : pitch,
      text: '',
      duration,
      ...(entryKind === 'note' ? { textParts: Array(selectedLength).fill('') } : {}),
    }
    const nextLine = [...line, ...rests, newEntry]
    setMeasures((current) => current.map((entry, index) => (index === measureIndex ? nextLine : entry)))
    setSelected({ measure: measureIndex, index: nextLine.length - 1 })
    setError(null)
  }

  const addPause = () => {
    const measureIndex = selected?.measure ?? measures.length - 1
    const line = measures[measureIndex]
    const pauseLength = NOTE_VALUES.find((entry) => entry.value === duration)?.eighths ?? 2
    if (measureLength(line) + pauseLength > measureCapacity(line)) {
      setError('Die Pause passt mit der gewählten Länge nicht mehr in den Takt.')
      return
    }

    const insertIndex = selected ? selected.index + 1 : line.length
    const pause: SongNote = { note: null, text: '', duration }
    const nextLine = [...line]
    nextLine.splice(insertIndex, 0, pause)
    setMeasures((current) =>
      current.map((entry, index) => (index === measureIndex ? nextLine : entry)),
    )
    setSelected({ measure: measureIndex, index: insertIndex })
    setEntryKind('rest')
    setError(null)
  }

  const updateTextPart = (measureIndex: number, noteIndex: number, partIndex: number, value: string) => {
    const note = measures[measureIndex][noteIndex]
    const parts = noteTexts(note)
    parts[partIndex] = value
    const textParts = parts.slice(0, noteEighths(note))
    const text = textParts.filter(Boolean).join(' ')
    setMeasures((current) =>
      current.map((line, index) =>
        index === measureIndex
          ? line.map((entry, entryIndex) =>
              entryIndex === noteIndex ? { ...entry, text, textParts } : entry,
            )
          : line,
      ),
    )
  }

  const removeSelected = () => {
    if (!selected) return
    setMeasures((current) =>
      current.map((line, index) =>
        index === selected.measure ? line.filter((_, noteIndex) => noteIndex !== selected.index) : line,
      ),
    )
    setSelected(null)
    setError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Bitte dem Lied einen Namen geben.')
      return
    }
    if (!isValidBeatsPerMinute(beatsPerMinute)) {
      setError(
        `Das Tempo muss zwischen ${BEATS_PER_MINUTE_RANGE.min} und ${BEATS_PER_MINUTE_RANGE.max} liegen.`,
      )
      return
    }
    const lines = measures.filter((line) => line.length > 0)
    if (!lines.some((line) => line.some((entry) => entry.note !== null))) {
      setError('Bitte mindestens eine Note eintragen.')
      return
    }

    saveSong({
      id: editingSongId ?? crypto.randomUUID(),
      name: name.trim(),
      beatsPerMinute,
      lines,
    })
    setSongs(loadAllSongs())
    clearEditor()
  }

  return (
    <section aria-label="Lied anlegen">
      <h2 className="ie-heading">{editingSongId ? 'Lied bearbeiten' : 'Lied anlegen'}</h2>
      <form className="ie-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Tempo (Viertelnoten pro Minute)
          <input
            type="number"
            min={BEATS_PER_MINUTE_RANGE.min}
            max={BEATS_PER_MINUTE_RANGE.max}
            value={beatsPerMinute}
            onChange={(event) => setBeatsPerMinute(Number(event.target.value))}
          />
        </label>

        <div className="ie-song-grid-editor" aria-label="Lied im 4/4-Takt eingeben">
          <div className="ie-song-grid-tools">
            <label>
              Eintrag
              <select value={entryKind} onChange={(event) => setEntryKind(event.target.value as 'note' | 'rest')}>
                <option value="note">Note</option>
                <option value="rest">Pause</option>
              </select>
            </label>
            <label>
              Tonhöhe
              <select
                value={selectedEntry?.note ?? pitch}
                disabled={entryKind === 'rest' && !selectedEntry}
                onChange={(event) => handlePitchChange(Number(event.target.value))}
              >
                {availablePitches.map((value) => (
                  <option key={value} value={value}>
                    {formatNote(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notenwert
              <select
                value={selectedEntry?.duration ?? duration}
                onChange={(event) => handleDurationChange(event.target.value as SongNoteValue)}
              >
                {NOTE_VALUES.map((value) => (
                  <option key={value.value} value={value.value}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <button type="button" className="ie-delete" onClick={removeSelected}>
                Eintrag entfernen
              </button>
            )}
            <button type="button" onClick={addPause}>
              Pause hinzufügen
            </button>
            <button type="button" onClick={() => setMeasures((current) => [...current, []])}>
              Takt hinzufügen
            </button>
            {measures.length > 1 && measures.at(-1)?.length === 0 && (
              <button type="button" onClick={() => setMeasures((current) => current.slice(0, -1))}>
                Leeren Takt entfernen
              </button>
            )}
          </div>

          <div className="ie-song-grid-measures">
            {measures.map((line, measureIndex) => {
              let offset = 0
              const columns = measureCapacity(line)
              const gridStyle = {
                gridTemplateColumns: `repeat(${columns}, minmax(48px, 1fr))`,
                minWidth: `${columns * 48}px`,
              }
              const placedNotes = line.map((note, noteIndex) => {
                const placed = { note, noteIndex, offset, length: noteEighths(note) }
                offset += placed.length
                return placed
              })

              return (
                <section className="ie-song-measure" key={measureIndex} aria-label={`Takt ${measureIndex + 1}`}>
                  <strong>Takt {measureIndex + 1}</strong>
                  <div className="ie-song-grid-scroll">
                    <div className="ie-song-grid-head" style={gridStyle} aria-hidden="true">
                      {Array.from({ length: columns }, (_, slot) => (
                        <span key={slot}>{slot % 2 === 0 ? `${(slot % GRID_COLUMNS) / 2 + 1}` : '&'}</span>
                      ))}
                    </div>
                    <div className="ie-song-grid-note-row" style={gridStyle} role="group" aria-label="Noten">
                      {placedNotes.map(({ note, noteIndex, offset: start, length }) => (
                        <button
                          key={noteIndex}
                          type="button"
                          className={`ie-song-grid-note ${noteIndex % 2 ? 'is-alt' : ''} ${
                            selected?.measure === measureIndex && selected.index === noteIndex
                              ? 'is-selected'
                              : ''
                          }`}
                          style={{ gridColumn: `${start + 1} / span ${length}` }}
                          aria-pressed={selected?.measure === measureIndex && selected.index === noteIndex}
                          onClick={() => setSelected({ measure: measureIndex, index: noteIndex })}
                        >
                          {note.note === null ? 'Pause' : formatNote(note.note)}
                        </button>
                      ))}
                      {Array.from({ length: columns - offset }, (_, index) => {
                        const slot = offset + index
                        return (
                          <button
                            key={`empty-${slot}`}
                            type="button"
                            className="ie-song-grid-empty"
                            style={{ gridColumn: `${slot + 1} / span 1` }}
                            aria-label={`Eintrag auf Achtel ${slot + 1} hinzufügen`}
                            onClick={() => addEntry(measureIndex, slot)}
                          >
                            +
                          </button>
                        )
                      })}
                    </div>
                    <div className="ie-song-grid-lyrics" style={gridStyle} role="group" aria-label="Text in Achteln">
                      {Array.from({ length: columns }, (_, slot) => {
                        const owner = noteAtSlot(line, slot)
                        const value = owner ? noteTexts(owner.note)[owner.innerOffset] ?? '' : ''
                        return (
                          <input
                            key={slot}
                            className={owner ? `is-note-${owner.index % 2}` : ''}
                            style={{ gridColumn: `${slot + 1} / span 1` }}
                            aria-label={`Text auf Takt ${measureIndex + 1}, Achtel ${slot + 1}`}
                            value={value}
                            disabled={!owner || owner.note.note === null}
                            onChange={(event) =>
                              owner && updateTextPart(measureIndex, owner.index, owner.innerOffset, event.target.value)
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="ie-error" role="alert">
            {error}
          </p>
        )}
        <div className="ie-song-form-actions">
          <button type="submit">{editingSongId ? 'Änderungen speichern' : 'Lied hinzufügen'}</button>
          {editingSongId && (
            <button type="button" onClick={clearEditor}>
              Bearbeiten abbrechen
            </button>
          )}
        </div>
      </form>

      {songs.length === 0 ? (
        <p className="ie-hint">Noch keine Lieder.</p>
      ) : (
        <ul className="ie-list" aria-label="Lieder verwalten">
          {songs.map((song) => (
            <li key={song.id} className="ie-item">
              <div className="ie-item-head">
                <strong>{song.name}</strong>
                <div className="ie-song-actions">
                  <button
                    type="button"
                    aria-label={`Lied "${song.name}" exportieren`}
                    onClick={() => downloadSong(song)}
                  >
                    Exportieren
                  </button>
                  <button
                    type="button"
                    aria-label={`Lied "${song.name}" bearbeiten`}
                    onClick={() => startEditing(song)}
                  >
                    Bearbeiten
                  </button>
                  {DEFAULT_SONGS.some((entry) => entry.id === song.id) ? (
                    <button
                      type="button"
                      aria-label={`Lied "${song.name}" zurücksetzen`}
                      onClick={() => handleResetSong(song)}
                    >
                      Zurücksetzen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ie-delete"
                      aria-label={`Lied "${song.name}" löschen`}
                      onClick={() => {
                        resetSongOverride(song.id)
                        setSongs(loadAllSongs())
                        if (editingSongId === song.id) clearEditor()
                      }}
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
              <ol className="ie-song-lines">
                {song.lines.map((line, index) => (
                  <li key={index}>{formatSongLine(line, formatNote)}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
