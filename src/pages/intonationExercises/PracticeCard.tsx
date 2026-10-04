import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from 'react'

import randomSyllables from '../../features/intonationPractice/config/randomSyllables.json'
import { formatNote } from '../../features/intonationPractice/notes'
import {
  decodeSyllableMode,
  encodeSyllableMode,
} from '../../features/intonationPractice/syllables'
import type { Section, Step, SyllableMode } from '../../features/intonationPractice/types'
import type { SingController } from './useSingStep'

function describeHeard({ detected, target }: NonNullable<SingController['progress']>) {
  if (!detected) return 'Kein Ton erkannt – bitte lauter oder näher am Mikrofon singen'
  const sameNoteOtherOctave = detected.midi !== target && detected.midi % 12 === target % 12
  return `Gehört: ${formatNote(detected.midi)}${sameNoteOtherOctave ? ' – richtige Note, aber andere Oktave' : ''}`
}

function MicIcon() {
  return (
    <svg
      className="ie-mic-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="ie-mic-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  )
}

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
  onShuffle?: () => void
  // Haltezeit pro Ton beim Singen (Standard: SING_HOLD_MS)
  holdMs?: number
  onPlay: (notes: (number | null)[]) => void
  sing?: SingController
  children?: ReactNode
}

export function PracticeCard({
  title,
  subtitle,
  sections,
  syllableMode,
  onSyllableModeChange,
  onShuffle,
  holdMs,
  onPlay,
  sing,
  children,
}: PracticeCardProps) {
  const cardId = useId()
  const stopOwned = sing?.stopOwned
  useEffect(() => () => stopOwned?.(cardId), [stopOwned, cardId])

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
          const stepKey = `${cardId}:${index}`
          const isListening = sing?.listeningKey === stepKey

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
                {entry.kind === 'random' && onShuffle && (
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
                {sing && !isDone && (
                  <button
                    type="button"
                    className={`ie-mic ${isListening ? 'is-listening' : ''}`}
                    aria-label={isListening ? 'Aufnahme beenden' : `${label} mit dem Mikrofon singen`}
                    aria-pressed={isListening}
                    disabled={index !== doneCount}
                    onClick={() =>
                      isListening
                        ? sing.stop()
                        : void sing.start(
                            stepKey,
                            entry.step.notes,
                            () => setDoneCount((count) => Math.max(count, index + 1)),
                            holdMs,
                          )
                    }
                  >
                    {isListening ? <StopIcon /> : <MicIcon />}
                  </button>
                )}
                {isListening && sing.progress && (
                  <span className="ie-sing-status" role="status">
                    Ton {sing.progress.noteIndex + 1} von {sing.progress.total}:{' '}
                    {formatNote(sing.progress.target)} halten
                    <progress value={sing.progress.hold} max={1} />
                    <span className="ie-sing-heard">{describeHeard(sing.progress)}</span>
                  </span>
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
