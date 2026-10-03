import { Fragment, useMemo, useState, type ReactNode } from 'react'

import randomSyllables from '../../features/intonationPractice/config/randomSyllables.json'
import { formatNote } from '../../features/intonationPractice/notes'
import {
  decodeSyllableMode,
  encodeSyllableMode,
} from '../../features/intonationPractice/syllables'
import type { Section, Step, SyllableMode } from '../../features/intonationPractice/types'

const describeStep = (step: Step) =>
  step.notes
    .map((note, index) =>
      [note === null ? 'Pause' : formatNote(note), step.syllables?.[index]].filter(Boolean).join(' '),
    )
    .join(', ')

function StepLabel({ step }: { step: Step }) {
  return step.notes.map((note, index) => (
    <Fragment key={index}>
      {index > 0 && <span className="ie-step-dash">–</span>}
      <span className="ie-step-note">
        <span>{note === null ? '·' : formatNote(note)}</span>
        {step.syllables && <small>{step.syllables[index]}</small>}
      </span>
    </Fragment>
  ))
}

type PracticeCardProps = {
  title: string
  subtitle: ReactNode
  sections: Section[]
  syllableMode?: SyllableMode
  onSyllableModeChange?: (mode: SyllableMode) => void
  onShuffle: () => void
  onPlay: (notes: (number | null)[]) => void
  children?: ReactNode
}

export function PracticeCard({
  title,
  subtitle,
  sections,
  syllableMode,
  onSyllableModeChange,
  onShuffle,
  onPlay,
  children,
}: PracticeCardProps) {
  const flatSteps = useMemo(
    () =>
      sections.flatMap((section) =>
        section.steps.map((step) => ({ kind: section.kind, title: section.title, step })),
      ),
    [sections],
  )
  // Anzahl der abgehakten Schritte; nur der nächste offene Schritt ist sichtbar.
  const [doneCount, setDoneCount] = useState(0)
  const visibleSteps = flatSteps.slice(0, doneCount + 1)
  const isComplete = doneCount >= flatSteps.length

  return (
    <li className={`ie-item ${isComplete ? 'is-complete' : ''}`}>
      <div className="ie-item-head">
        <div>
          <strong>{title}</strong>
          <span className="ie-notes">{subtitle}</span>
        </div>
        {syllableMode && onSyllableModeChange && (
          <label className="ie-syllable-select">
            Silbe
            <select
              value={encodeSyllableMode(syllableMode)}
              onChange={(event) => onSyllableModeChange(decodeSyllableMode(event.target.value))}
            >
              <option value="off">Aus</option>
              <option value="random">Zufällig</option>
              {randomSyllables.map((syllable) => (
                <option key={syllable} value={`fixed:${syllable}`}>
                  {syllable}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {children}

      <ol className="ie-sections">
        {visibleSteps.map((entry, index) => {
          const label = describeStep(entry.step)
          const isDone = index < doneCount
          const isFirstOfSection = index === 0 || visibleSteps[index - 1].title !== entry.title
          const canToggle = index === doneCount || index === doneCount - 1

          return (
            <li key={index} className={isDone ? 'is-done' : ''}>
              <span className="ie-section-title">{isFirstOfSection ? entry.title : ''}</span>
              <span className="ie-steps">
                <button
                  type="button"
                  className="ie-step"
                  aria-label={`${entry.title} abspielen: ${label}`}
                  onClick={() => onPlay(entry.step.notes)}
                >
                  <StepLabel step={entry.step} />
                </button>
                {entry.kind === 'random' && (
                  <button
                    type="button"
                    className="ie-step ie-shuffle"
                    aria-label="Zufällige Töne neu mischen"
                    title="Neu mischen"
                    onClick={onShuffle}
                  >
                    ↻
                  </button>
                )}
                <button
                  type="button"
                  className="ie-done"
                  aria-label={`${label} geschafft`}
                  aria-pressed={isDone}
                  disabled={!canToggle}
                  onClick={() => setDoneCount(isDone ? index : index + 1)}
                >
                  ✓
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {isComplete && <p className="ie-hint">Alle Schritte geschafft.</p>}
    </li>
  )
}
