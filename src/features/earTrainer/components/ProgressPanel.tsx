import {
  LEVEL_COUNT,
  SECTION_COUNT,
  STREAK_TARGET,
  TONE_STYLES,
  type ToneStyleId,
} from '../config'

type ProgressPanelProps = {
  levelIdx: number
  sectionIdx: number
  toneSet: readonly string[]
  unlockedToneStyles: ToneStyleId[]
  streak: number
  streakProgress: number
  leveledUpToast: string | null
}

export function ProgressPanel({
  levelIdx,
  sectionIdx,
  toneSet,
  unlockedToneStyles,
  streak,
  streakProgress,
  leveledUpToast,
}: ProgressPanelProps) {
  return (
    <div className="ear-panel">
      {leveledUpToast && <div className="toast ear-toast-levelup">{leveledUpToast}</div>}

      <div className="ear-meta">
        <span className="ear-meta-primary">
          Übung {levelIdx + 1} / {LEVEL_COUNT}
        </span>
        <span className="ear-meta-secondary">
          Abschnitt {sectionIdx + 1} / {SECTION_COUNT}
        </span>
      </div>

      <div className="ear-copy">Töne: {toneSet.join(' · ')}</div>
      <div className="ear-copy">
        Tonstile im Spiel:{' '}
        {unlockedToneStyles.map((style) => TONE_STYLES[style].label).join(' · ')}
      </div>

      <div className="ear-streak-wrap">
        <div className="ear-streak-label">
          Serie: {streak} / {STREAK_TARGET}
        </div>
        <div className="ear-streak-bar">
          <div className="ear-streak-fill" style={{ width: `${streakProgress}%` }} />
        </div>
      </div>
    </div>
  )
}
