import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import EarTrainer from './components/EarTrainer'
import { CoursePage } from './features/course/CoursePage'
import { INSTRUMENTS, TRAINING_CATEGORIES } from './features/earTrainer/config'
import { useTrainerProgress } from './features/earTrainer/hooks/useTrainerProgress'

function App() {
  const navigate = useNavigate()
  const progress = useTrainerProgress()

  const activeCategory =
    TRAINING_CATEGORIES[progress.activeCategoryIdx] ?? TRAINING_CATEGORIES[0]

  const openLevel = (categoryIdx: number, selectedLevelIdx: number) => {
    progress.setActiveCategoryIdx(categoryIdx)
    progress.setCategoryLevelIdx(categoryIdx, selectedLevelIdx)
    progress.setCategorySectionIdx(categoryIdx, 0)
    navigate('/trainer')
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/course" replace />} />
      <Route
        path="/course"
        element={
          <CoursePage
            loaded={progress.loaded}
            categories={TRAINING_CATEGORIES}
            instruments={INSTRUMENTS}
            activeCategoryIdx={progress.activeCategoryIdx}
            categoryProgress={progress.categoryProgress}
            selectedInstrumentId={progress.selectedInstrumentId}
            playbackVolume={progress.playbackVolume}
            onSelectedInstrumentChange={progress.setSelectedInstrumentId}
            onPlaybackVolumeChange={progress.setPlaybackVolume}
            onOpenLevel={openLevel}
            onContinue={() => navigate('/trainer')}
          />
        }
      />
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
            rangeFrequencyMultipliers={activeCategory.frequencyMultipliers}
            selectedInstrumentId={progress.selectedInstrumentId}
            playbackVolume={progress.playbackVolume}
            setPlaybackVolume={progress.setPlaybackVolume}
            onBackToCourse={() => navigate('/course')}
          />
        }
      />
      <Route path="*" element={<Navigate to="/course" replace />} />
    </Routes>
  )
}

export default App
