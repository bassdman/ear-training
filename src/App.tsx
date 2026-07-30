import { useState } from 'react'

import EarTrainer from './components/EarTrainer'
import { CoursePage } from './features/course/CoursePage'
import { useTrainerProgress } from './features/earTrainer/hooks/useTrainerProgress'

type Page = 'course' | 'trainer'

function App() {
  const [page, setPage] = useState<Page>('course')
  const progress = useTrainerProgress()

  const openLevel = (selectedLevelIdx: number) => {
    const shouldResetSection = selectedLevelIdx !== progress.levelIdx
    progress.setLevelIdx(selectedLevelIdx)
    if (shouldResetSection) {
      progress.setSectionIdx(0)
    }
    setPage('trainer')
  }

  return (
    page === 'course' ? (
      <CoursePage
        loaded={progress.loaded}
        currentLevelIdx={progress.levelIdx}
        unlockedLevelIdx={progress.unlockedLevelIdx}
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
        onBackToCourse={() => setPage('course')}
      />
    )
  )
}

export default App
