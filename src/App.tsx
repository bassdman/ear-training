import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import EarTrainer from './components/EarTrainer'
import { CampaignPage } from './features/campaign/CampaignPage'
import { CampaignTrainerPage } from './features/campaign/CampaignTrainerPage'
import { CoursePage } from './features/course/CoursePage'
import { HomePage } from './features/home/HomePage'
import {
  INSTRUMENTS,
  TRAINING_CATEGORIES,
  createExerciseSessionConfig,
  type DifficultyId,
} from './features/earTrainer/config'
import { useTrainerProgress } from './features/earTrainer/hooks/useTrainerProgress'

function App() {
  const navigate = useNavigate()
  const progress = useTrainerProgress()

  const activeCategory =
    TRAINING_CATEGORIES[progress.activeCategoryIdx] ?? TRAINING_CATEGORIES[0]
  const activeSessionConfig = createExerciseSessionConfig(
    progress.levelIdx,
    activeCategory.frequencyMultipliers,
    progress.difficultyConfig[progress.activeDifficultyId].toneStyleCount,
  )

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
          <EarTrainer
            loaded={progress.loaded}
            levelIdx={progress.levelIdx}
            sectionIdx={progress.sectionIdx}
            bestStreak={progress.bestStreak}
            setLevelIdx={progress.setLevelIdx}
            setSectionIdx={progress.setSectionIdx}
            setBestStreak={progress.setBestStreak}
            setUnlockedLevelIdx={progress.setUnlockedLevelIdx}
            rangeLabel={activeCategory.label}
            rangeSubtitle={activeCategory.subtitle}
            sessionConfig={activeSessionConfig}
            toneSplashMode={
              activeCategory.config.toneSplashByDifficulty[progress.activeDifficultyId]
            }
            selectedInstrumentId={progress.selectedInstrumentId}
            playbackVolume={progress.playbackVolume}
            setPlaybackVolume={progress.setPlaybackVolume}
            onBackToCourse={() => navigate('/course')}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
