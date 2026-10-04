import { useState, type FormEvent } from 'react'

import { formatNote } from '../../features/intonationPractice/notes'
import {
  BEATS_PER_MINUTE_RANGE,
  DEFAULT_BEATS_PER_MINUTE,
  formatSongLine,
  isValidBeatsPerMinute,
  parseSongInput,
} from '../../features/intonationPractice/songs'
import { loadSongs, saveSongs } from '../../features/intonationPractice/storage'
import type { Song } from '../../features/intonationPractice/types'

const PLACEHOLDER = `c4:Al e4:le g4:Vö g4:gel - c5:fliegt
a4:hoch a4:am g4:Him`

export function SongCreateSection() {
  const [songs, setSongs] = useState<Song[]>(loadSongs)
  const [name, setName] = useState('')
  const [beatsPerMinute, setBeatsPerMinute] = useState(DEFAULT_BEATS_PER_MINUTE)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const update = (next: Song[]) => {
    setSongs(next)
    saveSongs(next)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseSongInput(input)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
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

    update([
      ...songs,
      { id: crypto.randomUUID(), name: name.trim(), beatsPerMinute, lines: parsed.lines },
    ])
    setName('')
    setInput('')
    setError(null)
  }

  return (
    <section aria-label="Lied anlegen">
      <h2 className="ie-heading">Lied anlegen</h2>
      <form className="ie-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Tempo (beatsPerMinute, ein Ton pro Schlag)
          <input
            type="number"
            min={BEATS_PER_MINUTE_RANGE.min}
            max={BEATS_PER_MINUTE_RANGE.max}
            value={beatsPerMinute}
            onChange={(event) => setBeatsPerMinute(Number(event.target.value))}
          />
        </label>
        <label>
          Töne und Text
          <textarea
            rows={6}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={PLACEHOLDER}
            aria-describedby="ie-song-hint"
          />
        </label>
        <p id="ie-song-hint" className="ie-hint">
          Eine Zeile pro Liedzeile. Pro Ton <code>ton:text</code>, z. B. <code>c4:Al</code>. Ton ohne
          Text: <code>c4</code>. Pause: <code>-</code>. Das Lied wird nicht transponiert.
        </p>
        {error && (
          <p className="ie-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit">Lied hinzufügen</button>
      </form>

      {songs.length === 0 ? (
        <p className="ie-hint">Noch keine Lieder.</p>
      ) : (
        <ul className="ie-list" aria-label="Angelegte Lieder">
          {songs.map((song) => (
            <li key={song.id} className="ie-item">
              <div className="ie-item-head">
                <strong>{song.name}</strong>
                <button
                  type="button"
                  className="ie-delete"
                  onClick={() => update(songs.filter((entry) => entry.id !== song.id))}
                >
                  Löschen
                </button>
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
