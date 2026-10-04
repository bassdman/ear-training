import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatNote } from '../../features/intonationPractice/notes'
import {
  flattenSong,
  generateSongSections,
  sliceSong,
  type SongRange,
} from '../../features/intonationPractice/songs'
import { loadAllSongs } from '../../features/intonationPractice/storage'
import type { Song } from '../../features/intonationPractice/types'
import { usePlayNotes } from '../../features/intonationPractice/usePlayNotes'
import { PracticeCard } from './PracticeCard'
import { useSingStep, type SingController } from './useSingStep'

type SongItemProps = {
  song: Song
  onPlay: (notes: (number | null)[]) => void
  sing: SingController
}

function SongItem({ song, onPlay, sing }: SongItemProps) {
  const entries = useMemo(() => flattenSong(song), [song])
  const fullRange = useMemo<SongRange>(() => ({ start: 0, end: entries.length - 1 }), [entries])
  const [range, setRange] = useState<SongRange>(fullRange)
  // Erster Klick der Auswahl; erst der zweite Klick legt den Bereich fest.
  const [anchor, setAnchor] = useState<number | null>(null)
  const [shuffleCount, setShuffleCount] = useState(0)

  const selected = useMemo(() => sliceSong(song, range), [song, range])
  // shuffleCount erzwingt eine neue Zufallsreihenfolge.
  const sections = useMemo(
    () => generateSongSections(selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, shuffleCount],
  )
  const isFullSong = range.start === fullRange.start && range.end === fullRange.end

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
      key={`${range.start}-${range.end}`}
      title={song.name}
      subtitle={isFullSong ? 'Ganzes Lied' : `Auswahl: Ton ${range.start + 1} bis ${range.end + 1}`}
      sections={sections}
      onShuffle={() => setShuffleCount((count) => count + 1)}
      onPlay={onPlay}
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
  const { play, error: playError } = usePlayNotes()
  const sing = useSingStep()

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
          <SongItem key={song.id} song={song} onPlay={(notes) => void play(notes)} sing={sing} />
        ))}
      </ul>
    </>
  )
}
