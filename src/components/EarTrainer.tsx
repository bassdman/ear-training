import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { ProgressPanel } from '../features/earTrainer/components/ProgressPanel'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import { useEarTrainerGame } from '../features/earTrainer/hooks/useEarTrainerGame'
import { useTonePlayer } from '../features/earTrainer/hooks/useTonePlayer'
import '../features/earTrainer/earTrainer.css'

type EarTrainerProps = {
  loaded: boolean
  levelIdx: number
  sectionIdx: number
  bestStreak: number
  setLevelIdx: React.Dispatch<React.SetStateAction<number>>
  setSectionIdx: React.Dispatch<React.SetStateAction<number>>
  setBestStreak: React.Dispatch<React.SetStateAction<number>>
  setUnlockedLevelIdx: React.Dispatch<React.SetStateAction<number>>
  rangeLabel: string
  rangeSubtitle: string
  rangeFrequencyMultipliers: number[]
  onBackToCourse: () => void
}

export default function EarTrainer({
  loaded,
  levelIdx,
  sectionIdx,
  bestStreak,
  setLevelIdx,
  setSectionIdx,
  setBestStreak,
  setUnlockedLevelIdx,
  rangeLabel,
  rangeSubtitle,
  rangeFrequencyMultipliers,
  onBackToCourse,
}: EarTrainerProps) {

  const {
    toneSet,
    guessOptions,
    unlockedToneStyles,
    levelProgress,
    levelProgressTotal,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    accuracy,
    startTrial,
    getCurrentTrial,
    handleGuess,
  } = useEarTrainerGame({
    levelIdx,
    sectionIdx,
    bestStreak,
    progressSetters: {
      setLevelIdx,
      setSectionIdx,
      setBestStreak,
      setUnlockedLevelIdx,
    },
    frequencyMultipliers: rangeFrequencyMultipliers,
  })

  const { isPlaying, playTone } = useTonePlayer()

  const startAndPlayTrial = async () => {
    const trial = startTrial()
    if (!trial) return
    await playTone(trial.note, trial.toneStyle, trial.frequencyMultiplier)
  }

  const replayTone = async () => {
    const trial = getCurrentTrial()
    if (!trial) return
    await playTone(trial.note, trial.toneStyle, trial.frequencyMultiplier)
  }

  const currentTrial = getCurrentTrial()

  return (
    <div className="ear-page">
      {!loaded ? (
        <div className="ear-loading">Lade Fortschritt ...</div>
      ) : (
        <div className="ear-shell">
          <button className="ear-back-button" onClick={onBackToCourse}>
            Zur Kursseite
          </button>

          <TrainerHeader rangeLabel={rangeLabel} rangeSubtitle={rangeSubtitle} />

          <ProgressPanel
            levelIdx={levelIdx}
            sectionIdx={sectionIdx}
            toneSet={toneSet}
            unlockedToneStyles={unlockedToneStyles}
            levelProgress={levelProgress}
            levelProgressTotal={levelProgressTotal}
            leveledUpToast={leveledUpToast}
          />

          <ActiveSession
            accuracy={accuracy}
            forcedTrial={forcedTrial}
            isPlaying={isPlaying}
            awaitingGuess={awaitingGuess}
            hasCurrentTrial={Boolean(currentTrial)}
            feedback={feedback}
            guessOptions={guessOptions}
            onStartTrial={() => {
              void startAndPlayTrial()
            }}
            onReplay={() => {
              void replayTone()
            }}
            onGuess={handleGuess}
          />
        </div>
      )}
    </div>
  )
}