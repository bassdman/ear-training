import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { ProgressPanel } from '../features/earTrainer/components/ProgressPanel'
import { SessionSummary } from '../features/earTrainer/components/SessionSummary'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import type { NoteName } from '../features/earTrainer/config'
import { useEarTrainerGame } from '../features/earTrainer/hooks/useEarTrainerGame'
import { useTonePlayer } from '../features/earTrainer/hooks/useTonePlayer'
import { useTrainerProgress } from '../features/earTrainer/hooks/useTrainerProgress'
import '../features/earTrainer/earTrainer.css'

export default function EarTrainer() {
  const {
    loaded,
    levelIdx,
    sectionIdx,
    bestStreak,
    setLevelIdx,
    setSectionIdx,
    setBestStreak,
  } = useTrainerProgress()

  const {
    toneSet,
    unlockedToneStyles,
    streak,
    streakProgress,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    sessionGuesses,
    sessionCorrect,
    sessionEnded,
    accuracy,
    startTrial,
    getCurrentTrial,
    handleGuess,
    newSession,
  } = useEarTrainerGame({
    levelIdx,
    sectionIdx,
    bestStreak,
    progressSetters: {
      setLevelIdx,
      setSectionIdx,
      setBestStreak,
    },
  })

  const { isPlaying, playTone } = useTonePlayer()

  const startAndPlayTrial = async () => {
    const trial = startTrial()
    if (!trial) return
    await playTone(trial.note, trial.toneStyle)
  }

  const replayTone = async () => {
    const trial = getCurrentTrial()
    if (!trial) return
    await playTone(trial.note, trial.toneStyle)
  }

  const currentTrial = getCurrentTrial()

  return (
    <div className="ear-page">
      {!loaded ? (
        <div className="ear-loading">Lade Fortschritt ...</div>
      ) : (
        <div className="ear-shell">
          <TrainerHeader />

          <ProgressPanel
            levelIdx={levelIdx}
            sectionIdx={sectionIdx}
            toneSet={toneSet}
            unlockedToneStyles={unlockedToneStyles}
            streak={streak}
            streakProgress={streakProgress}
            leveledUpToast={leveledUpToast}
          />

          {!sessionEnded ? (
            <ActiveSession
              sessionGuesses={sessionGuesses}
              accuracy={accuracy}
              forcedTrial={forcedTrial}
              isPlaying={isPlaying}
              awaitingGuess={awaitingGuess}
              hasCurrentTrial={Boolean(currentTrial)}
              feedback={feedback}
              toneSet={toneSet as readonly NoteName[]}
              onStartTrial={() => {
                void startAndPlayTrial()
              }}
              onReplay={() => {
                void replayTone()
              }}
              onGuess={handleGuess}
            />
          ) : (
            <SessionSummary
              sessionCorrect={sessionCorrect}
              sessionGuesses={sessionGuesses}
              accuracy={accuracy}
              levelIdx={levelIdx}
              sectionIdx={sectionIdx}
              bestStreak={bestStreak}
              onNewSession={newSession}
            />
          )}
        </div>
      )}
    </div>
  )
}