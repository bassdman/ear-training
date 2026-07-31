import { useEffect } from 'react'

import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { ProgressPanel } from '../features/earTrainer/components/ProgressPanel'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import {
  INSTRUMENTS,
  type InstrumentId,
} from '../features/earTrainer/config'
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
  selectedInstrumentId: InstrumentId
  playbackVolume: number
  setPlaybackVolume: React.Dispatch<React.SetStateAction<number>>
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
  selectedInstrumentId,
  playbackVolume,
  setPlaybackVolume,
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

  const {
    isPlaying,
    isPreloading,
    loadStateByInstrument,
    startTone,
    stopTone,
    preloadInstrument,
  } = useTonePlayer()

  const activeLoad = loadStateByInstrument[selectedInstrumentId]
  const loadingPercent =
    activeLoad?.total && activeLoad.total > 0
      ? Math.min(100, Math.round((activeLoad.loaded / activeLoad.total) * 100))
      : 0
  const isSamplesLoading =
    INSTRUMENTS[selectedInstrumentId].playbackEngine === 'soundfont' &&
    (isPreloading || !activeLoad?.ready)

  useEffect(() => {
    void preloadInstrument(selectedInstrumentId)
  }, [preloadInstrument, selectedInstrumentId])

  const startAndHoldTrial = async () => {
    const trial = startTrial()
    if (!trial) return
    await startTone(
      trial.note,
      selectedInstrumentId,
      trial.toneStyle,
      trial.frequencyMultiplier,
      playbackVolume,
    )
  }

  const replayAndHoldTone = async () => {
    const trial = getCurrentTrial()
    if (!trial) return
    await startTone(
      trial.note,
      selectedInstrumentId,
      trial.toneStyle,
      trial.frequencyMultiplier,
      playbackVolume,
    )
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

          <div className="ear-panel ear-audio-panel">
            <div className="ear-audio-row">
              <label>Instrument</label>
              <div className="ear-samples-status">{INSTRUMENTS[selectedInstrumentId].label}</div>
            </div>

            <div className="ear-audio-row">
              <label htmlFor="ear-volume">Lautstärke</label>
              <div className="ear-volume-wrap">
                <input
                  id="ear-volume"
                  type="range"
                  min={0}
                  max={127}
                  step={1}
                  value={playbackVolume}
                  onChange={(event) => setPlaybackVolume(Number(event.target.value))}
                />
                <strong>{playbackVolume}</strong>
              </div>
            </div>

            <div className="ear-samples-status" role="status" aria-live="polite">
              {isSamplesLoading
                ? `Samples laden: ${loadingPercent}%`
                : 'Samples bereit'}
            </div>
          </div>

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
            onStartTrialPress={() => {
              void startAndHoldTrial()
            }}
            onStartTrialRelease={stopTone}
            onReplayPress={() => {
              void replayAndHoldTone()
            }}
            onReplayRelease={stopTone}
            onGuess={handleGuess}
          />
        </div>
      )}
    </div>
  )
}