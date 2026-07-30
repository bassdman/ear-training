import { EXERCISES } from '../earTrainer/config'
import './coursePage.css'

type CoursePageProps = {
  loaded: boolean
  currentLevelIdx: number
  unlockedLevelIdx: number
  onOpenLevel: (levelIdx: number) => void
  onContinue: () => void
}

export function CoursePage({
  loaded,
  currentLevelIdx,
  unlockedLevelIdx,
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
        <header className="course-header">
          <p className="course-kicker">Kursuebersicht</p>
          <h1>Gehörtraining</h1>
          <p className="course-subtitle">
            Waehle ein freigeschaltetes Level oder setze direkt bei deiner aktuellen Übung fort.
          </p>
          <button className="course-continue" onClick={onContinue}>
            Bei Übung {currentLevelIdx + 1} weitermachen
          </button>
        </header>

        <section className="course-grid" aria-label="Übungen">
          {EXERCISES.map((tones, index) => {
            const isLocked = index > unlockedLevelIdx
            const isActive = index === currentLevelIdx

            return (
              <button
                key={index}
                className={`course-card ${isLocked ? 'is-locked' : ''} ${isActive ? 'is-active' : ''}`}
                onClick={() => onOpenLevel(index)}
                disabled={isLocked}
              >
                <div className="course-card-top">
                  <span className="course-level">Übung {index + 1}</span>
                  <span className="course-state">
                    {isLocked ? 'Gesperrt' : isActive ? 'Aktuell' : 'Freigeschaltet'}
                  </span>
                </div>
                <div className="course-tones">{tones.join(' · ')}</div>
              </button>
            )
          })}
        </section>
      </div>
    </main>
  )
}
