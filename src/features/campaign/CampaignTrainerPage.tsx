import { Navigate, useNavigate } from 'react-router-dom'

import EarTrainer from '../../components/EarTrainer'
import {
  CAMPAIGN_RANGES,
  createCampaignSessionConfig,
  resolveCampaignAidSettings,
} from './config'
import { useCampaignProgress } from './hooks/useCampaignProgress'

export function CampaignTrainerPage() {
  const navigate = useNavigate()
  const progress = useCampaignProgress()

  if (progress.loaded && (!progress.hasProfile || !progress.progress.startRangeId)) {
    return <Navigate to="/campaign" replace />
  }

  if (!progress.progress.startRangeId) {
    return null
  }

  const allocatedPoints =
    progress.progress.noteUpgradePoints + progress.progress.aidReductionPoints
  const pendingPoints = Math.max(0, progress.progress.spentPoints - allocatedPoints)

  if (pendingPoints > 0) {
    return <Navigate to="/campaign" replace />
  }

  const range = CAMPAIGN_RANGES[progress.progress.startRangeId]
  const aidSettings = resolveCampaignAidSettings(progress.progress.aidReductionPoints)

  return (
    <EarTrainer
      loaded={progress.loaded}
      levelIdx={progress.progress.currentLevelIdx}
      sectionIdx={progress.progress.sectionIdx}
      bestStreak={progress.progress.bestStreak}
      setLevelIdx={progress.setCurrentLevelIdx}
      setSectionIdx={progress.setSectionIdx}
      setBestStreak={progress.setBestStreak}
      setUnlockedLevelIdx={progress.setUnlockedLevelIdx}
      rangeLabel={range.label}
      rangeSubtitle={range.subtitle}
      sessionConfig={createCampaignSessionConfig(
        progress.progress.startRangeId,
        progress.progress.currentLevelIdx,
        progress.progress.noteUpgradePoints,
        progress.progress.aidReductionPoints,
      )}
      toneSplashMode={aidSettings.toneSplashMode}
      selectedInstrumentId="piano"
      playbackVolume={100}
      setPlaybackVolume={() => {}}
      onBackToCourse={() => navigate('/campaign')}
      backButtonLabel="Zur Kampagne"
      autoStartNextOnLevelUp={false}
      onLevelCompleted={() => navigate('/campaign')}
    />
  )
}