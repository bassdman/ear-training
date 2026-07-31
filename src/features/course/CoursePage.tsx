import {
  EXERCISES,
  type CategoryProgressState,
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
  categoryProgress: CategoryProgressState[]
  selectedInstrumentId: InstrumentId
  playbackVolume: number
  onSelectedInstrumentChange: (value: InstrumentId) => void
  onPlaybackVolumeChange: (value: number) => void
  onOpenLevel: (categoryIdx: number, levelIdx: number) => void
  onContinue: () => void
}

export function CoursePage({
  loaded,
  categories,
  instruments,
  activeCategoryIdx,
  categoryProgress,
  selectedInstrumentId,
  playbackVolume,
  onSelectedInstrumentChange,
  onPlaybackVolumeChange,
  onOpenLevel,
  onContinue,
}: CoursePageProps) {
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
        {(() => {
          const activeCategory = categories[activeCategoryIdx] ?? categories[0]
          const activeProgress =
            categoryProgress[activeCategoryIdx] ??
            ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

          return (
            <header className="course-header">
              <p className="course-kicker">Kursübersicht</p>
              <h1>Gehörtraining</h1>
              <p className="course-subtitle">
                Jede Lage hat eine eigene Übungsreihe. Du kannst in jeder Kategorie bei
                Übung 1 anfangen und den Fortschritt getrennt aufbauen.
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
              <button className="course-continue" onClick={onContinue}>
                Weiter in {activeCategory.label}: Übung {activeProgress.levelIdx + 1}
              </button>
            </header>
          )
        })()}

        <section className="course-groups" aria-label="Kategorien">
          {categories.map((category, categoryIdx) => {
            const progress =
              categoryProgress[categoryIdx] ??
              ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 } as CategoryProgressState)

            return (
              <article key={category.id} className="course-group">
                <div className="course-group-header">
                  <div>
                    <h2>{category.label}</h2>
                    <p>{category.subtitle}</p>
                  </div>
                  <div className="course-group-status">
                    Aktuell: Übung {progress.levelIdx + 1}
                  </div>
                </div>

                <div className="course-grid" aria-label={`${category.label} Übungen`}>
                  {EXERCISES.map((tones, levelIdx) => {
                    const isLocked = levelIdx > progress.unlockedLevelIdx
                    const isActive =
                      categoryIdx === activeCategoryIdx && levelIdx === progress.levelIdx

                    return (
                      <button
                        key={`${category.id}-${levelIdx}`}
                        className={`course-card ${isLocked ? 'is-locked' : ''} ${isActive ? 'is-active' : ''}`}
                        onClick={() => onOpenLevel(categoryIdx, levelIdx)}
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
