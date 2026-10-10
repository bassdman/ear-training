import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatNote } from '../../features/intonationPractice/notes'
import {
  flattenSong,
  generateSongSections,
  noteDurationSeconds,
  SONG_TRANSPOSE_RANGE,
  sliceSong,
  transposeSong,
  type SongRange,
} from '../../features/intonationPractice/songs'
import {
  loadAllSongs,
  loadSongTranspositions,
  saveSongTranspositions,
} from '../../features/intonationPractice/storage'
import type { Song } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'
import { PracticeCard } from './PracticeCard'
import { SING_HOLD_MS, useSingStep, type SingController } from './useSingStep'

type SongItemProps = {
  song: Song
  transpose: number
  onTransposeChange: (transpose: number) => void
  onPlay: (notes: (number | null)[], options: { noteDurationS: number }) => void
  sing: SingController
}

function SongItem({ song, transpose, onTransposeChange, onPlay: playWithOptions, sing }: SongItemProps) {
  const noteDurationS = noteDurationSeconds(song)
  const onPlay = (notes: (number | null)[]) => playWithOptions(notes, { noteDurationS })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const transposedSong = useMemo(() => transposeSong(song, transpose), [song, transpose])
  const entries = useMemo(() => flattenSong(transposedSong), [transposedSong])
  const fullRange = useMemo<SongRange>(() => ({ start: 0, end: entries.length - 1 }), [entries])
  const [range, setRange] = useState<SongRange>(fullRange)
  // Erster Klick der Auswahl; erst der zweite Klick legt den Bereich fest.
  const [anchor, setAnchor] = useState<number | null>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [settingsOpen])

  const selected = useMemo(() => sliceSong(transposedSong, range), [transposedSong, range])
  const isFullSong = range.start === fullRange.start && range.end === fullRange.end
  const sections = useMemo(
    () => generateSongSections(selected, { withSelection: !isFullSong }),
    [selected, isFullSong],
  )

  const handleChipClick = (index: number) => {
    if (anchor === null) {
      setAnchor(index)
      return
    }
    setRange({ start: Math.min(anchor, index), end: Math.max(anchor, index) })
    setAnchor(null)
  }

  const resetRange = () => {
    setRange(fullRange)
    setAnchor(null)
  }

  return (
    <PracticeCard
      key={`${range.start}-${range.end}-${transpose}`}
      title={song.name}
      subtitle={isFullSong ? 'Ganzes Lied' : `Auswahl: Ton ${range.start + 1} bis ${range.end + 1}`}
      sections={sections}
      headerActions={
        <div className={`ie-song-settings ${settingsOpen ? 'is-open' : ''}`} ref={settingsRef}>
          <button
            type="button"
            className="ie-song-settings-toggle"
            aria-label="Lied-Einstellungen"
            aria-expanded={settingsOpen}
            aria-controls={`song-settings-${song.id}`}
            title="Lied-Einstellungen"
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" />
            </svg>
          </button>
          <div
            className="ie-song-settings-panel"
            id={`song-settings-${song.id}`}
            hidden={!settingsOpen}
          >
            <div className="ie-transpose" role="group" aria-label="Lied transponieren">
              <span>Transposition</span>
              <output aria-live="polite">
                {transpose > 0 ? `+${transpose}` : transpose} Halbtöne
              </output>
              <div className="ie-transpose-controls">
                <button
                  type="button"
                  className="ie-transpose-step"
                  aria-label="Einen Halbton tiefer"
                  title="Einen Halbton tiefer"
                  disabled={transpose <= SONG_TRANSPOSE_RANGE.min}
                  onClick={() => onTransposeChange(Math.max(SONG_TRANSPOSE_RANGE.min, transpose - 1))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="ie-transpose-step"
                  aria-label="Einen Halbton höher"
                  title="Einen Halbton höher"
                  disabled={transpose >= SONG_TRANSPOSE_RANGE.max}
                  onClick={() => onTransposeChange(Math.min(SONG_TRANSPOSE_RANGE.max, transpose + 1))}
                >
                  +
                </button>
              </div>
              {transpose !== 0 && (
                <button
                  type="button"
                  className="ie-transpose-reset"
                  onClick={() => onTransposeChange(0)}
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
        </div>
      }
      onPlay={onPlay}
      holdMs={Math.min(SING_HOLD_MS, noteDurationS * 1000)}
      sing={sing}
    >
      <div className="ie-song-select">
        <ol className="ie-song-text" aria-label="Liedtext">
          {song.lines.map((_, lineIndex) => (
            <li key={lineIndex}>
              {entries
                .filter((entry) => entry.line === lineIndex)
                .map((entry) => {
                  const inRange = entry.index >= range.start && entry.index <= range.end
                  return (
                    <span
                      key={entry.index}
                      className={`ie-song-entry ${inRange ? 'is-in-range' : ''}`}
                    >
                      <button
                        type="button"
                        className={`ie-song-chip ${anchor === entry.index ? 'is-anchor' : ''}`}
                        aria-pressed={inRange}
                        aria-label={
                          entry.note === null
                            ? 'Pause'
                            : `${formatNote(entry.note)} ${entry.text}`.trim()
                        }
                        onClick={() => handleChipClick(entry.index)}
                      >
                        {entry.note === null ? '·' : formatNote(entry.note)}
                      </button>
                      <small>{entry.text}</small>
                    </span>
                  )
                })}
            </li>
          ))}
        </ol>
        <p className="ie-hint">
          {anchor === null
            ? 'Zwei Töne anklicken, um einen Bereich auszuwählen.'
            : 'Jetzt das Ende des Bereichs anklicken.'}
        </p>
        <div className="ie-song-actions">
          <button
            type="button"
            className="ie-step"
            onClick={() =>
              onPlay(entries.slice(range.start, range.end + 1).map((entry) => entry.note))
            }
          >
            ▶ Auswahl abspielen
          </button>
          {!isFullSong && (
            <button type="button" className="ie-step" onClick={resetRange}>
              Ganzes Lied
            </button>
          )}
        </div>
      </div>
    </PracticeCard>
  )
}

export function IntonationSongsPage() {
  const [songs] = useState<Song[]>(loadAllSongs)
  const [transpositions, setTranspositions] = useState(loadSongTranspositions)
  const { play, error: playError } = usePlayNotes()
  const sing = useSingStep()

  useEffect(() => saveSongTranspositions(transpositions), [transpositions])

  if (songs.length === 0) {
    return (
      <p className="ie-hint">
        Noch keine Lieder. <Link to="/intonation-exercises/create">Lied erstellen</Link>
      </p>
    )
  }

  return (
    <>
      {(playError || sing.error) && (
        <p className="ie-error" role="alert">
          {playError ?? sing.error}
        </p>
      )}
      <ul className="ie-list" aria-label="Lieder">
        {songs.map((song) => (
          <SongItem
            key={song.id}
            song={song}
            transpose={transpositions[song.id] ?? 0}
            onTransposeChange={(transpose) =>
              setTranspositions((current) => ({ ...current, [song.id]: transpose }))
            }
            onPlay={(notes, options) => void play(notes, options)}
            sing={sing}
          />
        ))}
      </ul>
    </>
  )
}
