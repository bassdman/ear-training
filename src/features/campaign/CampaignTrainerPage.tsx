import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import EarTrainer from '../../components/EarTrainer'
import {
  CAMPAIGN_RANGES,
  createCampaignSessionConfig,
  resolveCampaignAidSettings,
} from './config'
import { useCampaignProgress } from './hooks/useCampaignProgress'

export function CampaignTrainerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const progress = useCampaignProgress()

  const requestedLevel = Number(searchParams.get('level'))
  const selectedLevelIdx = useMemo(() => {
    if (!Number.isFinite(requestedLevel)) {
      return progress.progress.currentLevelIdx
    }

    const rounded = Math.round(requestedLevel)
    const clamped = Math.max(0, Math.min(progress.progress.unlockedLevelIdx, rounded))
    return clamped
  }, [progress.progress.currentLevelIdx, progress.progress.unlockedLevelIdx, requestedLevel])

  const isProgressionRun = selectedLevelIdx === progress.progress.currentLevelIdx

  const [localLevelIdx, setLocalLevelIdx] = useState(selectedLevelIdx)
  const [localSectionIdx, setLocalSectionIdx] = useState(0)
  const [, setLocalUnlockedLevelIdx] = useState(selectedLevelIdx)

  useEffect(() => {
    if (isProgressionRun) return

    setLocalLevelIdx(selectedLevelIdx)
    setLocalSectionIdx(0)
    setLocalUnlockedLevelIdx(selectedLevelIdx)
  }, [isProgressionRun, selectedLevelIdx])

  if (progress.loaded && (!progress.hasProfile || !progress.progress.startRangeId)) {
    return <Navigate to="/campaign" replace />
  }

  if (!progress.progress.startRangeId) {
    return null
  }

  const range = CAMPAIGN_RANGES[progress.progress.startRangeId]
  const aidSettings = resolveCampaignAidSettings(
    progress.progress.toneStyleDifficultyPoints,
    progress.progress.toneSplashDifficultyPoints,
  )
  const trainerLevelIdx = isProgressionRun ? progress.progress.currentLevelIdx : localLevelIdx
  const trainerSectionIdx = isProgressionRun ? progress.progress.sectionIdx : localSectionIdx
  const trainerSetLevelIdx = isProgressionRun ? progress.setCurrentLevelIdx : setLocalLevelIdx
  const trainerSetSectionIdx = isProgressionRun ? progress.setSectionIdx : setLocalSectionIdx
  const trainerSetUnlockedLevelIdx = isProgressionRun
    ? progress.setUnlockedLevelIdx
    : setLocalUnlockedLevelIdx

  return (
    <EarTrainer
      loaded={progress.loaded}
      levelIdx={trainerLevelIdx}
      sectionIdx={trainerSectionIdx}
      bestStreak={progress.progress.bestStreak}
      setLevelIdx={trainerSetLevelIdx}
      setSectionIdx={trainerSetSectionIdx}
      setBestStreak={progress.setBestStreak}
      setUnlockedLevelIdx={trainerSetUnlockedLevelIdx}
      rangeLabel={range.label}
      rangeSubtitle={range.subtitle}
      sessionConfig={createCampaignSessionConfig(
        progress.progress.startRangeId,
        trainerLevelIdx,
        progress.progress.noteDifficultyPoints,
        progress.progress.toneStyleDifficultyPoints,
        progress.progress.toneSplashDifficultyPoints,
        progress.progress.fallbackBreakCount,
        progress.progress.totalNotes,
      )}
      toneSplashMode={aidSettings.toneSplashMode}
      selectedInstrumentId="piano"
      playbackVolume={100}
      setPlaybackVolume={() => {}}
      onBackToCourse={() => navigate('/campaign')}
      backButtonLabel="Zur Kampagne"
      autoStartNextOnLevelUp={false}
      onLevelCompleted={() => navigate(isProgressionRun ? '/campaign?upgrade=1' : '/campaign')}
    />
  )
}