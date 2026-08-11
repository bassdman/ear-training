import EarTrainer from "../../components/EarTrainer"
import { useTrainerProgress } from "../../features/earTrainer/hooks/useTrainerProgress"
import { TRAINING_CATEGORIES, createExerciseSessionConfig } from "../../features/earTrainer/config"
export function TrainerPage({onBackToCourse}: {onBackToCourse: () => void}) {
      const progress = useTrainerProgress();
       const activeCategory =
          TRAINING_CATEGORIES[progress.activeCategoryIdx] ?? TRAINING_CATEGORIES[0]
      const activeSessionConfig = createExerciseSessionConfig(
        progress.levelIdx,
        activeCategory.frequencyMultipliers,
        progress.difficultyConfig[progress.activeDifficultyId].toneStyleCount,
      )
    return  <EarTrainer
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
                onBackToCourse={onBackToCourse}
              />
}