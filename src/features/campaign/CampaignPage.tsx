import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT,
  CAMPAIGN_DEFAULT_INTERVAL_TONE_COUNT,
  CAMPAIGN_FALLBACK_BREAK_OPTIONS,
  CAMPAIGN_INTERVAL_TONE_OPTIONS,
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_NOTE_COUNT_MAX,
  CAMPAIGN_NOTE_COUNT_MIN,
  CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  CAMPAIGN_RANGES,
  CAMPAIGN_VOICE_TYPES,
  resolveCampaignAidSettings,
  resolveCampaignExerciseLevelIdx,
  resolveCampaignSectionSteps,
  resolveCampaignTotalDifficulty,
  resolveRequiredDifficultyForLevel,
} from './config'
import './campaignPage.css'
import { useCampaignProgress } from './hooks/useCampaignProgress'
import type { CampaignRangeId } from './types'

type CampaignPageProps = {
  onBackHome: () => void
  onOpenExercises: () => void
  onOpenTrainer: (levelIdx: number) => void
}

export function CampaignPage({ onBackHome, onOpenExercises, onOpenTrainer }: CampaignPageProps) {
  const {
    loaded,
    progress,
    setCurrentLevelIdx,
    setStartRangeId,
    setCampaignDifficulty,
    resetProfile,
  } = useCampaignProgress()
  const [searchParams] = useSearchParams()
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0)
  const [modalLevelIdx, setModalLevelIdx] = useState<number | null>(null)
  const [modalStartRangeId, setModalStartRangeId] = useState<CampaignRangeId>('male-low')
  const [modalFallbackBreakCount, setModalFallbackBreakCount] = useState(
    CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT,
  )
  const [modalIntervalToneCount, setModalIntervalToneCount] = useState(
    CAMPAIGN_DEFAULT_INTERVAL_TONE_COUNT,
  )
  const [modalNoteLevel, setModalNoteLevel] = useState(CAMPAIGN_NOTE_COUNT_MIN)
  const [modalToneStyleLevel, setModalToneStyleLevel] = useState(0)
  const [modalToneSplashLevel, setModalToneSplashLevel] = useState(0)

  const startRangeOptions: Array<{ id: CampaignRangeId; label: string }> = [
    { id: 'male-low', label: 'Männerstimme tief' },
    { id: 'low', label: 'Männerstimme hoch' },
    { id: 'mid', label: 'Frauenstimme tief' },
    { id: 'high', label: 'Frauenstimme hoch' },
  ]

  const pathLevels = useMemo(
    () => Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, levelIdx) => levelIdx),
    [],
  )
  const shouldEmphasizeUpgradeChoice = searchParams.get('upgrade') === '1'
  const isUpgradeModalOpen = modalLevelIdx !== null || shouldEmphasizeUpgradeChoice
  const noteCount = resolveCampaignExerciseLevelIdx(progress.noteDifficultyPoints)
  const totalDifficulty = resolveCampaignTotalDifficulty(
    progress.noteDifficultyPoints,
    progress.toneStyleDifficultyPoints,
    progress.toneSplashDifficultyPoints,
  )
  const requiredDifficulty = resolveRequiredDifficultyForLevel(selectedLevelIdx)
  const modalTotalDifficulty = resolveCampaignTotalDifficulty(
    modalNoteLevel,
    modalToneStyleLevel,
    modalToneSplashLevel,
  )
  const modalRequiredDifficulty = resolveRequiredDifficultyForLevel(
    modalLevelIdx ?? selectedLevelIdx,
  )
  const modalCanStartLevel = modalTotalDifficulty >= modalRequiredDifficulty
  const maxSliderLevel = 4
  const modalAidSettings = resolveCampaignAidSettings(
    modalToneStyleLevel,
    modalToneSplashLevel,
  )
  const modalSectionSteps = resolveCampaignSectionSteps(
    modalFallbackBreakCount,
    modalIntervalToneCount,
  )
  const modalFinalIntervalTones = modalIntervalToneCount * 2

  const getToneSplashDescription = (level: number) => {
    switch (level) {
      case 0:
        return 'Dauerhafte Farbanzeige als starke Hilfe.'
      case 1:
        return 'Farbanzeige bleibt dauerhaft aktiv.'
      case 2:
        return 'Farbanzeige nur kurz sichtbar.'
      case 3:
        return 'Farbanzeige kurz und weniger dominant.'
      default:
        return 'Keine Farbanzeige, reine Höraufgabe.'
    }
  }

  const getToneStyleDescription = (level: number) => {
    switch (level) {
      case 0:
        return 'Ein Klangstil, maximale Konstanz.'
      case 1:
        return 'Leichte Variation mit zwei Klangstilen.'
      case 2:
        return 'Zwei Klangstile im regelmäßigen Wechsel.'
      case 3:
        return 'Drei Klangstile, deutlich variabler.'
      default:
        return 'Vier Klangstile, hohe Klangvariabilität.'
    }
  }

  const getNoteDescription = (level: number) => {
    return `${level} Noten aktiv (A1 bis H6 im Gesamtbereich).`
  }

  useEffect(() => {
    setSelectedLevelIdx((prev) => {
      if (prev <= progress.unlockedLevelIdx) {
        return prev
      }

      return progress.currentLevelIdx
    })
  }, [progress.currentLevelIdx, progress.unlockedLevelIdx])

  useEffect(() => {
    if (!shouldEmphasizeUpgradeChoice) return
    if (modalLevelIdx !== null) return

    setModalLevelIdx(selectedLevelIdx)
    setModalStartRangeId(progress.startRangeId ?? 'male-low')
    setModalFallbackBreakCount(progress.fallbackBreakCount)
    setModalIntervalToneCount(progress.intervalToneCount)
    setModalNoteLevel(
      Math.min(
        CAMPAIGN_NOTE_COUNT_MAX,
        Math.max(CAMPAIGN_NOTE_COUNT_MIN, progress.noteDifficultyPoints),
      ),
    )
    setModalToneStyleLevel(Math.min(progress.toneStyleDifficultyPoints, maxSliderLevel))
    setModalToneSplashLevel(Math.min(progress.toneSplashDifficultyPoints, maxSliderLevel))
  }, [maxSliderLevel, modalLevelIdx, progress.noteDifficultyPoints, progress.toneSplashDifficultyPoints, progress.toneStyleDifficultyPoints, selectedLevelIdx, shouldEmphasizeUpgradeChoice])

  const requestLevelStart = (levelIdx: number) => {
    setCurrentLevelIdx(levelIdx)
    setSelectedLevelIdx(levelIdx)
    setModalStartRangeId(progress.startRangeId ?? 'male-low')
    setModalFallbackBreakCount(progress.fallbackBreakCount)
    setModalIntervalToneCount(progress.intervalToneCount)
    setModalNoteLevel(
      Math.min(
        CAMPAIGN_NOTE_COUNT_MAX,
        Math.max(CAMPAIGN_NOTE_COUNT_MIN, progress.noteDifficultyPoints),
      ),
    )
    setModalToneStyleLevel(Math.min(progress.toneStyleDifficultyPoints, maxSliderLevel))
    setModalToneSplashLevel(Math.min(progress.toneSplashDifficultyPoints, maxSliderLevel))
    setModalLevelIdx(levelIdx)
  }

  const startSelectedLevel = () => {
    requestLevelStart(selectedLevelIdx)
  }

  const continueToTrainer = () => {
    const targetLevelIdx = modalLevelIdx ?? selectedLevelIdx
    setStartRangeId(modalStartRangeId)
    setCampaignDifficulty({
      notes: modalNoteLevel,
      toneStyle: modalToneStyleLevel,
      toneSplash: modalToneSplashLevel,
      fallbackBreakCount: modalFallbackBreakCount,
      intervalToneCount: modalIntervalToneCount,
    })
    setModalLevelIdx(null)
    onOpenTrainer(targetLevelIdx)
  }

  const closeUpgradeModal = () => {
    setModalLevelIdx(null)
  }

  if (!loaded) {
    return (
      <main className="campaign-page">
        <div className="campaign-shell">
          <p className="campaign-loading">Lade Kampagne ...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="campaign-page">
      <div className="campaign-shell">
        <header className="campaign-header">
          <p className="campaign-kicker">Kampagnenmodus</p>
          <h1>Dein Trainingspfad</h1>
          <p className="campaign-subtitle">
            Dieser Modus baut eine zusammenhängende Progression über 80 Schritte auf.
            Startlage und Schwierigkeit stellst du direkt beim Levelstart im Auswahlfenster ein.
          </p>
          <div className="campaign-actions">
            <button className="campaign-link-button" onClick={onBackHome}>
              Zur Startseite
            </button>
            <button className="campaign-link-button is-secondary" onClick={onOpenExercises}>
              Zu den Übungen
            </button>
          </div>
        </header>

        <>
            <section className="campaign-summary" aria-label="Kampagnenstatus">
              <div className="campaign-summary-card">
                <span>Stimmtyp</span>
                <strong>{progress.voiceType ? CAMPAIGN_VOICE_TYPES[progress.voiceType].label : 'Offen'}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Start-Lage</span>
                <strong>
                  {progress.startRangeId
                    ? `${CAMPAIGN_RANGES[progress.startRangeId].label} · ${CAMPAIGN_RANGES[progress.startRangeId].subtitle}`
                    : 'Offen'}
                </strong>
              </div>
              <div className="campaign-summary-card">
                <span>Aktueller Schritt</span>
                <strong>Level {progress.currentLevelIdx + 1}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Gewähltes Level</span>
                <strong>Level {selectedLevelIdx + 1}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Schwierigkeitspunkte</span>
                <strong>{progress.spentPoints}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Aktive Schwierigkeit</span>
                <strong>
                  Level {totalDifficulty} · benötigt: {requiredDifficulty}
                </strong>
              </div>
              <div className="campaign-summary-card">
                <span>Anzahl an Noten</span>
                <strong>{noteCount} / {CAMPAIGN_NOTE_COUNT_MAX}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Fallbacks / Intervalltöne</span>
                <strong>
                  {progress.fallbackBreakCount} / {progress.intervalToneCount} ({progress.intervalToneCount * 2})
                </strong>
              </div>
            </section>

            <section className="campaign-panel" aria-label="Kampagnenpfad">
              <div className="campaign-panel-header">
                <h2>Sichtbarer Pfad</h2>
                <p>
                  In diesem Schnitt ist der erste spielbare Abschnitt der Start-Lage
                  angeschlossen. Der Rest des Pfads bleibt vorerst Platzhalter.
                </p>
              </div>

              <div className="campaign-path-grid">
                {pathLevels.map((levelIdx) => {
                  const isCurrent = levelIdx === progress.currentLevelIdx
                  const isSelected = levelIdx === selectedLevelIdx
                  const isUnlocked = levelIdx <= progress.unlockedLevelIdx
                  const stateClass = isCurrent
                    ? 'is-current'
                    : isUnlocked
                      ? 'is-unlocked'
                      : 'is-locked'
                  const selectedClass = isSelected ? 'is-selected' : ''

                  return (
                    <button
                      type="button"
                      key={levelIdx}
                      className={`campaign-path-node ${stateClass} ${selectedClass}`}
                      aria-label={`Level ${levelIdx + 1}`}
                      onClick={() => {
                        if (!isUnlocked) return
                        requestLevelStart(levelIdx)
                      }}
                      disabled={!isUnlocked}
                    >
                      <span>{levelIdx + 1}</span>
                    </button>
                  )
                })}
              </div>

              <div className="campaign-footnote">
                <div>
                  <p>Spielbar ist jetzt der erste Start-Lagen-Abschnitt mit den ersten {CAMPAIGN_PLAYABLE_LEVEL_COUNT} Schritten.</p>
                  <p>
                    Für jeden Start muss die eingestellte Gesamtschwierigkeit den Zielwert
                    des gewählten Levels erreichen.
                  </p>
                </div>
                <div className="campaign-footnote-actions">
                  <button
                    className="campaign-primary-button"
                    onClick={startSelectedLevel}
                  >
                    Gewähltes Level spielen
                  </button>
                  <button className="campaign-reset-button" onClick={resetProfile}>
                    Einstellungen zurücksetzen
                  </button>
                </div>
              </div>
            </section>

            {isUpgradeModalOpen && (
              <div className="campaign-upgrade-backdrop" role="presentation">
                <section className="campaign-upgrade-modal" role="dialog" aria-modal="true" aria-label="Punkte verteilen">
                  <h2>
                    {shouldEmphasizeUpgradeChoice
                      ? 'Neuer Kampagnenpunkt'
                      : 'Einstellungen vor dem Start'}
                  </h2>
                  <p>
                    Stelle jede Schwierigkeitssäule separat ein.
                    Jeder Schritt nach rechts erhöht die Schwierigkeit um 1.
                  </p>
                  {modalLevelIdx !== null ? (
                    <p>Als Nächstes startest du Level {modalLevelIdx + 1}.</p>
                  ) : (
                    <p>Als Nächstes kannst du direkt ein freigeschaltetes Level starten.</p>
                  )}

                  <label className="campaign-select-row">
                    <span>Anzahl an Fallbacks (Ear-Scale-Break)</span>
                    <select
                      value={modalFallbackBreakCount}
                      onChange={(event) => setModalFallbackBreakCount(Number(event.target.value))}
                    >
                      {CAMPAIGN_FALLBACK_BREAK_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="campaign-slider-description">
                    Anzahl sichtbarer Ear-Scale-Breaks im Fortschritt: {modalFallbackBreakCount}
                  </p>

                  <label className="campaign-select-row">
                    <span>Anzahl an Töne pro Intervall</span>
                    <select
                      value={modalIntervalToneCount}
                      onChange={(event) => setModalIntervalToneCount(Number(event.target.value))}
                    >
                      {CAMPAIGN_INTERVAL_TONE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} ({option * 2})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="campaign-slider-description">
                    Klammerwert gilt immer fuer den letzten Abschnitt. Aktuell: {modalIntervalToneCount} ({modalFinalIntervalTones})
                    · Abschnittsverteilung: {modalSectionSteps.join(' / ')}
                  </p>

                  <label className="campaign-select-row">
                    <span>Startlage</span>
                    <select
                      value={modalStartRangeId}
                      onChange={(event) =>
                        setModalStartRangeId(event.target.value as CampaignRangeId)
                      }
                    >
                      {startRangeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="campaign-slider-description">
                    Aktiv bei diesem Wert: {CAMPAIGN_RANGES[modalStartRangeId].label} ·{' '}
                    {CAMPAIGN_RANGES[modalStartRangeId].subtitle}
                  </p>

                  <label className="campaign-slider-row">
                    <span>Anzahl an Noten: {modalNoteLevel}</span>
                    <input
                      type="range"
                      min={CAMPAIGN_NOTE_COUNT_MIN}
                      max={CAMPAIGN_NOTE_COUNT_MAX}
                      step={1}
                      value={modalNoteLevel}
                      onChange={(event) => setModalNoteLevel(Number(event.target.value))}
                    />
                  </label>
                  <p className="campaign-slider-description">
                    {getNoteDescription(modalNoteLevel)}
                  </p>

                  <label className="campaign-slider-row">
                    <span>Klangstil-Varianz: {modalToneStyleLevel}</span>
                    <input
                      type="range"
                      min={0}
                      max={maxSliderLevel}
                      step={1}
                      value={modalToneStyleLevel}
                      onChange={(event) => setModalToneStyleLevel(Number(event.target.value))}
                    />
                  </label>
                  <p className="campaign-slider-description">
                    {getToneStyleDescription(modalToneStyleLevel)}
                  </p>

                  <label className="campaign-slider-row">
                    <span>Farbhilfe-Reduktion: {modalToneSplashLevel}</span>
                    <input
                      type="range"
                      min={0}
                      max={maxSliderLevel}
                      step={1}
                      value={modalToneSplashLevel}
                      onChange={(event) => setModalToneSplashLevel(Number(event.target.value))}
                    />
                  </label>
                  <p className="campaign-slider-description">
                    {getToneSplashDescription(modalToneSplashLevel)}
                  </p>
                  <p className="campaign-slider-description">
                    Aktiv bei diesem Wert: {modalAidSettings.toneStyleCount} Tonstil(e),
                    Farbhinweis {modalAidSettings.toneSplashMode}.
                  </p>
                  <p className="campaign-slider-description">
                    Gesamtschwierigkeit: {modalTotalDifficulty} · benötigt für Level{' '}
                    {(modalLevelIdx ?? selectedLevelIdx) + 1}: {modalRequiredDifficulty}
                  </p>
                  <div className="campaign-upgrade-footer">
                    <button className="campaign-reset-button" onClick={closeUpgradeModal}>
                      Zurück
                    </button>
                    <button
                      className="campaign-primary-button"
                      onClick={continueToTrainer}
                      disabled={!modalCanStartLevel}
                    >
                      Weiter zu Level {modalLevelIdx !== null ? modalLevelIdx + 1 : selectedLevelIdx + 1}
                    </button>
                  </div>
                </section>
              </div>
            )}
        </>
      </div>
    </main>
  )
}