import type { SongNoteValue } from '../../features/intonationPractice/types'

type SongGridItem = {
  id: string
  note: number | null
  text: string
  textParts?: string[]
  duration?: SongNoteValue
}

type SongGridDisplayProps = {
  items: readonly SongGridItem[]
  formatNote: (note: number) => string
  selectedIds?: ReadonlySet<string>
  anchorId?: string | null
  onItemClick?: (id: string) => void
  label?: string
}

const EIGHTHS_BY_VALUE: Record<SongNoteValue, number> = {
  whole: 8,
  half: 4,
  quarter: 2,
  eighth: 1,
}
const GRID_COLUMNS = 8
type PlacedSongGridItem = { item: SongGridItem; start: number; length: number; colorIndex: number }

function noteEighths(item: SongGridItem): number {
  return EIGHTHS_BY_VALUE[item.duration ?? 'quarter']
}

export function SongGridDisplay({
  items,
  formatNote,
  selectedIds,
  anchorId,
  onItemClick,
  label = 'Liednoten',
}: SongGridDisplayProps) {
  const measures: PlacedSongGridItem[][] = []
  let measure: PlacedSongGridItem[] = []
  let used = 0

  for (const [colorIndex, item] of items.entries()) {
    const length = noteEighths(item)
    if (used + length > GRID_COLUMNS && measure.length > 0) {
      measures.push(measure)
      measure = []
      used = 0
    }
    measure.push({ item, start: used, length, colorIndex })
    used += length
  }
  if (measure.length > 0) measures.push(measure)

  return (
    <div className="ie-song-grid-display" role="group" aria-label={label}>
      {measures.map((entries) => (
        <div className="ie-song-grid-display-measure" key={entries[0].item.id}>
          <div className="ie-song-grid-display-head" aria-hidden="true">
            {Array.from({ length: GRID_COLUMNS }, (_, slot) => (
              <span key={slot}>{slot % 2 === 0 ? `${slot / 2 + 1}` : '&'}</span>
            ))}
          </div>
          <div className="ie-song-grid-display-notes">
            {entries.map(({ item, start, length, colorIndex }) => {
              const isSelected = selectedIds?.has(item.id) ?? false
              const className = [
                'ie-song-grid-display-note',
                colorIndex % 2 === 1 ? 'is-alt' : '',
                isSelected ? 'is-in-range' : '',
                anchorId === item.id ? 'is-anchor' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const content = item.note === null ? 'Pause' : formatNote(item.note)
              return onItemClick ? (
                <button
                  key={item.id}
                  type="button"
                  className={className}
                  style={{ gridColumn: `${start + 1} / span ${length}` }}
                  aria-label={item.note === null ? 'Pause auswählen' : `${formatNote(item.note)} auswählen`}
                  aria-pressed={isSelected}
                  onClick={() => onItemClick(item.id)}
                >
                  {content}
                </button>
              ) : (
                <span
                  key={item.id}
                  className={className}
                  style={{ gridColumn: `${start + 1} / span ${length}` }}
                >
                  {content}
                </span>
              )
            })}
            {entries.at(-1)!.start + entries.at(-1)!.length < GRID_COLUMNS && (
              <span
                className="ie-song-grid-display-empty"
                style={{
                  gridColumn: `${entries.at(-1)!.start + entries.at(-1)!.length + 1} / span ${
                    GRID_COLUMNS - entries.at(-1)!.start - entries.at(-1)!.length
                  }`,
                }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="ie-song-grid-display-text">
            {Array.from({ length: GRID_COLUMNS }, (_, slot) => {
              const owner = entries.find(({ start, length }) => slot >= start && slot < start + length)
              const partIndex = owner ? slot - owner.start : -1
              const text = owner
                ? (owner.item.textParts?.[partIndex] ?? (partIndex === 0 ? owner.item.text : ''))
                : ''
              const alternate = owner && owner.colorIndex % 2 === 1
              return (
                <span
                  key={slot}
                  className={alternate ? 'is-alt' : ''}
                  aria-label={text ? `Text: ${text}` : undefined}
                >
                  {text}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
