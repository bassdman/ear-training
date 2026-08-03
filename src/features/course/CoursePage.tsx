import { useMemo, useState } from 'react'

import {
  TRAINING_DIFFICULTIES,
  type CategoryDifficultyProgressState,
  EXERCISES,
  type CategoryProgressState,
  type DifficultyId,
  type InstrumentId,
  type TrainingCategory,
} from '../earTrainer/config'
import './coursePage.css'

type CoursePageProps = {
  loaded: boolean
  categories: TrainingCategory[]
  instruments: Record<
    InstrumentId,
    {
      label: string
    }
  >
  activeCategoryIdx: number
  activeDifficultyId: DifficultyId
  difficultyIds: DifficultyId[]
  difficultyConfig: typeof TRAINING_DIFFICULTIES
  categoryDifficultyProgress: CategoryDifficultyProgressState
  selectedInstrumentId: InstrumentId
  playbackVolume: number
  onSelectedInstrumentChange: (value: InstrumentId) => void
  onPlaybackVolumeChange: (value: number) => void
  onActiveDifficultyChange: (difficultyId: DifficultyId) => void
  onOpenLevel: (categoryIdx: number, difficultyId: DifficultyId, levelIdx: number) => void
  onContinue: (categoryIdx: number, difficultyId: DifficultyId) => void
  onOpenCampaign: () => void
}

export function CoursePage({
  loaded,
  categories,
  instruments,
  activeCategoryIdx,
  activeDifficultyId,
  difficultyIds,
  difficultyConfig,
  categoryDifficultyProgress,
  selectedInstrumentId,
  playbackVolume,
  onSelectedInstrumentChange,
  onPlaybackVolumeChange,
  onActiveDifficultyChange,
  onOpenLevel,
  onContinue,
  onOpenCampaign,
}: CoursePageProps) {
  const [selectedDifficultyByCategory, setSelectedDifficultyByCategory] = useState<
    Record<string, DifficultyId>
  >({})

  const activeCategory = categories[activeCategoryIdx] ?? categories[0]
  const activeCategoryDifficulty =
    selectedDifficultyByCategory[activeCategory.id] ?? activeDifficultyId
  const activeProgress =
    categoryDifficultyProgress[activeCategoryDifficulty]?.[activeCategoryIdx] ??
    ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

  const resolveDifficultyForCategory = useMemo(
    () =>
      (categoryId: string): DifficultyId =>
        selectedDifficultyByCategory[categoryId] ?? 'easy',
    [selectedDifficultyByCategory],
  )

  if (!loaded) {
    return (
      <main className="course-page">
        <div className="course-shell">
          <p className="course-loading">Lade Kurs ...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="course-page">
      <div className="course-shell">
        <header className="course-header">
          <p className="course-kicker">Kursübersicht</p>
          <h1>Gehörtraining</h1>
          <p className="course-subtitle">
            Jede Lage hat eine eigene Übungsreihe. Du kannst in jeder Kategorie bei
            Übung 1 anfangen und den Fortschritt je Schwierigkeitsgrad getrennt aufbauen.
          </p>
          <div className="course-audio-settings" aria-label="Audio-Einstellungen">
            <label className="course-audio-row">
              <span>Instrument</span>
              <select
                value={selectedInstrumentId}
                onChange={(event) =>
                  onSelectedInstrumentChange(event.target.value as InstrumentId)
                }
              >
                {(Object.keys(instruments) as InstrumentId[]).map((styleId) => (
                  <option key={styleId} value={styleId}>
                    {instruments[styleId].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="course-audio-row">
              <span>Lautstärke</span>
              <div className="course-volume-wrap">
                <input
                  type="range"
                  min={0}
                  max={127}
                  step={1}
                  value={playbackVolume}
                  onChange={(event) =>
                    onPlaybackVolumeChange(Number(event.target.value))
                  }
                />
                <strong>{playbackVolume}</strong>
              </div>
            </label>
          </div>
          <div className="course-header-actions">
            <button
              className="course-continue"
              onClick={() => onContinue(activeCategoryIdx, activeCategoryDifficulty)}
            >
              Weiter in {activeCategory.label}: {difficultyConfig[activeCategoryDifficulty].label} · Übung {activeProgress.levelIdx + 1}
            </button>
            <button className="course-campaign-link" onClick={onOpenCampaign}>
              Kampagnenmodus öffnen
            </button>
          </div>
        </header>

        <section className="course-groups" aria-label="Kategorien">
          {categories.map((category, categoryIdx) => {
            const selectedDifficulty = resolveDifficultyForCategory(category.id)
            const progress =
              categoryDifficultyProgress[selectedDifficulty]?.[categoryIdx] ??
              ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

            return (
              <article key={category.id} className="course-group">
                <div className="course-group-header">
                  <div>
                    <h2>{category.label}</h2>
                    <p>{category.subtitle}</p>
                  </div>
                  <div className="course-group-status">
                    {difficultyConfig[selectedDifficulty].label}: Übung {progress.levelIdx + 1}
                  </div>
                </div>

                <div className="course-difficulty-tabs" role="tablist" aria-label={`${category.label} Schwierigkeitsgrad`}>
                  {difficultyIds.map((difficultyId) => {
                    const isSelected = difficultyId === selectedDifficulty
                    return (
                      <button
                        key={`${category.id}-${difficultyId}`}
                        role="tab"
                        aria-selected={isSelected}
                        className={`course-difficulty-tab ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedDifficultyByCategory((prev) => ({
                            ...prev,
                            [category.id]: difficultyId,
                          }))
                          if (categoryIdx === activeCategoryIdx) {
                            onActiveDifficultyChange(difficultyId)
                          }
                        }}
                      >
                        {difficultyConfig[difficultyId].label}
                      </button>
                    )
                  })}
                </div>

                <div className="course-grid" aria-label={`${category.label} Übungen`}>
                  {EXERCISES.map((tones, levelIdx) => {
                    const isLocked = levelIdx > progress.unlockedLevelIdx
                    const isActive =
                      categoryIdx === activeCategoryIdx &&
                      selectedDifficulty === activeDifficultyId &&
                      levelIdx === progress.levelIdx

                    return (
                      <button
                        key={`${category.id}-${levelIdx}`}
                        className={`course-card ${isLocked ? 'is-locked' : ''} ${isActive ? 'is-active' : ''}`}
                        onClick={() => onOpenLevel(categoryIdx, selectedDifficulty, levelIdx)}
                        disabled={isLocked}
                      >
                        <div className="course-card-top">
                          <span className="course-level">Übung {levelIdx + 1}</span>
                          <span className="course-state">
                            {isLocked
                              ? 'Gesperrt'
                              : isActive
                                ? 'Aktuell'
                                : 'Freigeschaltet'}
                          </span>
                        </div>
                        <div className="course-tones">{tones.join(' · ')}</div>
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
