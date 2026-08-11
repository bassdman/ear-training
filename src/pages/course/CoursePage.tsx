import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  EXERCISES,
  type CategoryProgressState,
  type DifficultyId,
  INSTRUMENTS,
  TRAINING_CATEGORIES,
} from '../../features/earTrainer/config'
import './coursePage.css'
import { useTrainerProgress } from '../../features/earTrainer/hooks/useTrainerProgress'

type InstrumentId = keyof typeof INSTRUMENTS

export function CoursePage() {
  const navigate = useNavigate()
  const [selectedDifficultyByCategory, setSelectedDifficultyByCategory] = useState<
    Record<string, DifficultyId>
  >({})

  const progress = useTrainerProgress()

  const activeCategory = TRAINING_CATEGORIES[progress.activeCategoryIdx] ?? TRAINING_CATEGORIES[0]
  const activeCategoryDifficulty =
    selectedDifficultyByCategory[activeCategory.id] ?? progress.activeDifficultyId
  const activeProgress =
    progress.categoryDifficultyProgress[activeCategoryDifficulty]?.[progress.activeCategoryIdx] ??
    ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

  const continueTraining = () => {
    progress.setActiveCategoryIdx(progress.activeCategoryIdx)
    progress.setActiveDifficultyId(activeCategoryDifficulty)
    navigate('/trainer')
  }

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

  const resolveDifficultyForCategory = (categoryId: string) =>
    selectedDifficultyByCategory[categoryId] ?? 'easy'

  if (!progress.loaded) {
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
                value={progress.selectedInstrumentId}
                onChange={(event) =>
                  progress.setSelectedInstrumentId(event.target.value as InstrumentId)
                }
              >
                {(Object.keys(INSTRUMENTS) as InstrumentId[]).map((styleId) => (
                  <option key={styleId} value={styleId}>
                    {INSTRUMENTS[styleId].label}
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
                  value={progress.playbackVolume}
                  onChange={(event) =>
                    progress.setPlaybackVolume(Number(event.target.value))
                  }
                />
                <strong>{progress.playbackVolume}</strong>
              </div>
            </label>
          </div>
          <div className="course-header-actions">
            <button
              className="course-continue"
              onClick={continueTraining}
            >
              Weiter in {activeCategory.label}: {progress.difficultyConfig[activeCategoryDifficulty].label} · Übung{' '}
              {activeProgress.levelIdx + 1}
            </button>
            <button className="course-campaign-link" onClick={() => navigate('/campaign')}>
              Kampagnenmodus öffnen
            </button>
          </div>
        </header>

        <section className="course-groups" aria-label="Kategorien">
          {TRAINING_CATEGORIES.map((category, categoryIdx) => {
            const selectedDifficulty = resolveDifficultyForCategory(category.id)
            const categoryProgress =
              progress.categoryDifficultyProgress[selectedDifficulty]?.[categoryIdx] ??
              ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

            return (
              <article key={category.id} className="course-group">
                <div className="course-group-header">
                  <div>
                    <h2>{category.label}</h2>
                    <p>{category.subtitle}</p>
                  </div>
                  <div className="course-group-status">
                    {progress.difficultyConfig[selectedDifficulty].label}: Übung {categoryProgress.levelIdx + 1}
                  </div>
                </div>

                <div
                  className="course-difficulty-tabs"
                  role="tablist"
                  aria-label={`${category.label} Schwierigkeitsgrad`}
                >
                  {progress.difficultyIds.map((difficultyId) => {
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
                          if (categoryIdx === progress.activeCategoryIdx) {
                            progress.setActiveDifficultyId(difficultyId)
                          }
                        }}
                      >
                        {progress.difficultyConfig[difficultyId].label}
                      </button>
                    )
                  })}
                </div>

                <div className="course-grid" aria-label={`${category.label} Übungen`}>
                  {EXERCISES.map((tones, levelIdx) => {
                    const isLocked = levelIdx > categoryProgress.unlockedLevelIdx
                    const isActive =
                      categoryIdx === progress.activeCategoryIdx &&
                      selectedDifficulty === progress.activeDifficultyId &&
                      levelIdx === progress.levelIdx

                    return (
                      <button
                        key={`${category.id}-${levelIdx}`}
                        className={`course-card ${isLocked ? 'is-locked' : ''} ${isActive ? 'is-active' : ''}`}
                        onClick={() => openLevel(categoryIdx, selectedDifficulty, levelIdx)}
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
