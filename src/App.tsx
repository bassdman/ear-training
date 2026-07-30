import { useState } from 'react'

import EarTrainer from './components/EarTrainer'
import { CoursePage } from './features/course/CoursePage'
import { TONE_STYLES, TRAINING_CATEGORIES } from './features/earTrainer/config'
import { useTrainerProgress } from './features/earTrainer/hooks/useTrainerProgress'

type Page = 'course' | 'trainer'

function App() {
  const [page, setPage] = useState<Page>('course')
  const progress = useTrainerProgress()

  const activeCategory =
    TRAINING_CATEGORIES[progress.activeCategoryIdx] ?? TRAINING_CATEGORIES[0]

  const openLevel = (categoryIdx: number, selectedLevelIdx: number) => {
    progress.setActiveCategoryIdx(categoryIdx)
    progress.setCategoryLevelIdx(categoryIdx, selectedLevelIdx)
    progress.setCategorySectionIdx(categoryIdx, 0)
    setPage('trainer')
  }

  return (
    page === 'course' ? (
      <CoursePage
        loaded={progress.loaded}
        categories={TRAINING_CATEGORIES}
        toneStyles={TONE_STYLES}
        activeCategoryIdx={progress.activeCategoryIdx}
        categoryProgress={progress.categoryProgress}
        toneStyleMode={progress.toneStyleMode}
        playbackVolume={progress.playbackVolume}
        onToneStyleModeChange={progress.setToneStyleMode}
        onPlaybackVolumeChange={progress.setPlaybackVolume}
        onOpenLevel={openLevel}
        onContinue={() => setPage('trainer')}
      />
    ) : (
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
        toneStyleMode={progress.toneStyleMode}
        playbackVolume={progress.playbackVolume}
        setToneStyleMode={progress.setToneStyleMode}
        setPlaybackVolume={progress.setPlaybackVolume}
        onBackToCourse={() => setPage('course')}
      />
    )
  )
}

export default App
