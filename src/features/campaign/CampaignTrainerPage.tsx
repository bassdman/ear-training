import { Navigate, useNavigate } from 'react-router-dom'

import EarTrainer from '../../components/EarTrainer'
import {
  CAMPAIGN_RANGES,
  createCampaignSessionConfig,
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

  const range = CAMPAIGN_RANGES[progress.progress.startRangeId]

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
      )}
      toneSplashMode="persistent"
      selectedInstrumentId="piano"
      playbackVolume={100}
      setPlaybackVolume={() => {}}
      onBackToCourse={() => navigate('/campaign')}
      backButtonLabel="Zur Kampagne"
    />
  )
}