import type { ReactNode } from 'react'

import {
  TONE_STYLES,
  type ToneStyleId,
} from '../config'

type ProgressPanelProps = {
  levelIdx: number
  sectionIdx: number
  toneSet: readonly string[]
  unlockedToneStyles: ToneStyleId[]
  unlockedToneStyleNames?: string[]
  levelProgress: number
  levelProgressTotal: number
  levelCount: number
  sectionSteps: readonly number[]
  leveledUpToast: string | null
}

export function ProgressPanel({
  levelIdx,
  sectionIdx,
  toneSet,
  unlockedToneStyles,
  unlockedToneStyleNames,
  levelProgress,
  levelProgressTotal,
  levelCount,
  sectionSteps,
  leveledUpToast,
}: ProgressPanelProps) {
  const scaleCells = Array.from({ length: levelProgressTotal }, (_, index) => index)
  const sectionBreaks = new Set(
    sectionSteps.slice(0, -1).reduce<number[]>((breaks, steps, index) => {
      const previous = index === 0 ? 0 : breaks[index - 1]
      breaks.push(previous + steps)
      return breaks
    }, []),
  )
  const scaleParts = scaleCells.flatMap((cell) => {
    const parts: ReactNode[] = []

    if (sectionBreaks.has(cell)) {
      parts.push(
        <span key={`break-${cell}`} className="ear-scale-break" aria-hidden="true" />,
      )
    }

    parts.push(
      <span
        key={`cell-${cell}`}
        className={`ear-scale-cell ${cell < levelProgress ? 'is-filled' : ''}`}
      />,
    )

    return parts
  })

  return (
    <div className="ear-panel">
      {leveledUpToast && <div className="toast ear-toast-levelup">{leveledUpToast}</div>}

      <div className="ear-meta">
        <span className="ear-meta-primary">
          Übung {levelIdx + 1} / {levelCount}
        </span>
        <span className="ear-meta-secondary">
          Abschnitt {sectionIdx + 1} / {sectionSteps.length}
        </span>
      </div>

      <div className="ear-copy">Töne: {toneSet.join(' · ')}</div>
      <div className="ear-copy">
        Tonstile im Spiel:{' '}
        {(unlockedToneStyleNames && unlockedToneStyleNames.length > 0
          ? unlockedToneStyleNames
          : unlockedToneStyles.map((style) => TONE_STYLES[style].label)
        ).join(' · ')}
      </div>

      <div className="ear-streak-wrap">
        <div className="ear-streak-label">
          Fortschritt: {levelProgress} / {levelProgressTotal}
        </div>
        <div className="ear-scale" aria-label="Übungsfortschritt">
          {scaleParts}
        </div>
      </div>
    </div>
  )
}
