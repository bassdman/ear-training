import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { CampaignPage } from './features/campaign/CampaignPage'
import { CampaignTrainerPage } from './features/campaign/CampaignTrainerPage'
import { CoursePage } from './pages/course/CoursePage'
import { HomePage } from './pages/home/HomePage'
import {
  INSTRUMENTS,
  TRAINING_CATEGORIES,
  type DifficultyId,
} from './features/earTrainer/config'
import { useTrainerProgress } from './features/earTrainer/hooks/useTrainerProgress'
import { TrainerPage } from './pages/TrainerPage'

function App() {
  const navigate = useNavigate()
  const progress = useTrainerProgress()

  const openLevel = (
    categoryIdx: number,
    difficultyId: DifficultyId,
    selectedLevelIdx: number,
  ) => {
    progress.setActiveCategoryIdx(categoryIdx)
    progress.setActiveDifficultyId(difficultyId)
    progress.setCategoryLevelIdx(categoryIdx, difficultyId, selectedLevelIdx)
    progress.setCategorySectionIdx(categoryIdx, difficultyId, 0)
    navigate('/trainer')
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/course"
        element={
          <CoursePage
            loaded={progress.loaded}
            categories={TRAINING_CATEGORIES}
            instruments={INSTRUMENTS}
            activeCategoryIdx={progress.activeCategoryIdx}
            activeDifficultyId={progress.activeDifficultyId}
            difficultyConfig={progress.difficultyConfig}
            difficultyIds={progress.difficultyIds}
            categoryDifficultyProgress={progress.categoryDifficultyProgress}
            selectedInstrumentId={progress.selectedInstrumentId}
            playbackVolume={progress.playbackVolume}
            onSelectedInstrumentChange={progress.setSelectedInstrumentId}
            onPlaybackVolumeChange={progress.setPlaybackVolume}
            onActiveDifficultyChange={progress.setActiveDifficultyId}
            onOpenLevel={openLevel}
            onContinue={(categoryIdx, difficultyId) => {
              progress.setActiveCategoryIdx(categoryIdx)
              progress.setActiveDifficultyId(difficultyId)
              navigate('/trainer')
            }}
            onOpenCampaign={() => navigate('/campaign')}
          />
        }
      />
      <Route
        path="/campaign"
        element={
          <CampaignPage
            onBackHome={() => navigate('/')}
            onOpenExercises={() => navigate('/course')}
            onOpenTrainer={(levelIdx) => navigate(`/campaign/trainer?level=${levelIdx}`)}
          />
        }
      />
      <Route path="/campaign/trainer" element={<CampaignTrainerPage />} />
      <Route
        path="/trainer"
        element={
          <TrainerPage onBackToCourse={() => navigate('/course')} />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
