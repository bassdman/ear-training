import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  CAMPAIGN_RANGES,
  CAMPAIGN_VOICE_TYPES,
  CAMPAIGN_VOICE_TYPE_IDS,
  resolveCampaignAidSettings,
  resolveCampaignExerciseLevelIdx,
} from './config'
import './campaignPage.css'
import { useCampaignProgress } from './hooks/useCampaignProgress'
import type { CampaignRangeId, CampaignVoiceType } from './types'

type CampaignPageProps = {
  onBackHome: () => void
  onOpenExercises: () => void
  onOpenTrainer: (levelIdx: number) => void
}

export function CampaignPage({ onBackHome, onOpenExercises, onOpenTrainer }: CampaignPageProps) {
  const { loaded, progress, hasProfile, setProfile, setCampaignDifficulty, resetProfile } = useCampaignProgress()
  const [selectedVoiceType, setSelectedVoiceType] = useState<CampaignVoiceType>('bass')
  const [searchParams] = useSearchParams()
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0)
  const [modalLevelIdx, setModalLevelIdx] = useState<number | null>(null)
  const [modalNoteLevel, setModalNoteLevel] = useState(1)
  const [modalToneStyleLevel, setModalToneStyleLevel] = useState(1)
  const [modalToneSplashLevel, setModalToneSplashLevel] = useState(1)

  const selectedVoice = CAMPAIGN_VOICE_TYPES[selectedVoiceType]
  const selectedRangeId = (selectedVoice.startRangeOptions[0] ?? 'male-low') as CampaignRangeId

  const pathLevels = useMemo(
    () => Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, levelIdx) => levelIdx),
    [],
  )
  const shouldEmphasizeUpgradeChoice = searchParams.get('upgrade') === '1'
  const isUpgradeModalOpen = modalLevelIdx !== null || shouldEmphasizeUpgradeChoice
  const aidSettings = resolveCampaignAidSettings(
    progress.toneStyleDifficultyPoints,
    progress.toneSplashDifficultyPoints,
  )
  const effectiveExerciseLevelIdx = resolveCampaignExerciseLevelIdx(
    progress.currentLevelIdx,
    progress.noteDifficultyPoints,
  )
  const totalDifficulty =
    progress.noteDifficultyPoints +
    progress.toneStyleDifficultyPoints +
    progress.toneSplashDifficultyPoints
  const requiredDifficulty = selectedLevelIdx + 3
  const modalTotalDifficulty =
    modalNoteLevel + modalToneStyleLevel + modalToneSplashLevel
  const modalRequiredDifficulty = (modalLevelIdx ?? selectedLevelIdx) + 3
  const modalCanStartLevel = modalTotalDifficulty >= modalRequiredDifficulty
  const maxSliderLevel = 4
  const modalAidSettings = resolveCampaignAidSettings(
    modalToneStyleLevel,
    modalToneSplashLevel,
  )

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
    switch (level) {
      case 0:
        return 'Keine Zusatznote gegenüber dem Basislevel.'
      case 1:
        return 'Eine zusätzliche Note wird einbezogen.'
      case 2:
        return 'Zwei zusätzliche Noten werden einbezogen.'
      case 3:
        return 'Drei zusätzliche Noten werden einbezogen.'
      default:
        return 'Vier zusätzliche Noten werden einbezogen.'
    }
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
    setModalNoteLevel(Math.min(progress.noteDifficultyPoints, maxSliderLevel))
    setModalToneStyleLevel(Math.min(progress.toneStyleDifficultyPoints, maxSliderLevel))
    setModalToneSplashLevel(Math.min(progress.toneSplashDifficultyPoints, maxSliderLevel))
  }, [maxSliderLevel, modalLevelIdx, progress.noteDifficultyPoints, progress.toneSplashDifficultyPoints, progress.toneStyleDifficultyPoints, selectedLevelIdx, shouldEmphasizeUpgradeChoice])

  const requestLevelStart = (levelIdx: number) => {
    setSelectedLevelIdx(levelIdx)
    setModalNoteLevel(Math.min(progress.noteDifficultyPoints, maxSliderLevel))
    setModalToneStyleLevel(Math.min(progress.toneStyleDifficultyPoints, maxSliderLevel))
    setModalToneSplashLevel(Math.min(progress.toneSplashDifficultyPoints, maxSliderLevel))
    setModalLevelIdx(levelIdx)
  }

  const startSelectedLevel = () => {
    requestLevelStart(selectedLevelIdx)
  }

  const continueToTrainer = () => {
    const targetLevelIdx = modalLevelIdx ?? selectedLevelIdx
    setCampaignDifficulty({
      notes: modalNoteLevel,
      toneStyle: modalToneStyleLevel,
      toneSplash: modalToneSplashLevel,
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
            In diesem ersten Schnitt legen wir nur Einstieg, Profil und die sichtbare
            Wegstruktur an.
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

        {!hasProfile ? (
          <section className="campaign-panel" aria-label="Kampagnenprofil wählen">
            <div className="campaign-panel-header">
              <h2>Welcher Stimmtyp bist du?</h2>
              <p>
                Der Stimmtyp definiert den relativen Einstiegspunkt der Kampagne.
                In diesem Schritt bleibt die Auswahl bewusst einfach.
              </p>
            </div>

            <label className="campaign-select-row">
              <span>Stimmtyp</span>
              <select
                value={selectedVoiceType}
                onChange={(event) =>
                  setSelectedVoiceType(event.target.value as CampaignVoiceType)
                }
              >
                {CAMPAIGN_VOICE_TYPE_IDS.map((voiceType) => (
                  <option key={voiceType} value={voiceType}>
                    {CAMPAIGN_VOICE_TYPES[voiceType].label}
                  </option>
                ))}
              </select>
            </label>

            <p className="campaign-select-description">{selectedVoice.description}</p>

            <p className="campaign-auto-range-note">
              Start-Lage: {CAMPAIGN_RANGES[selectedRangeId].label} ·{' '}
              {CAMPAIGN_RANGES[selectedRangeId].subtitle}
            </p>

            <button
              className="campaign-primary-button"
              onClick={() => setProfile(selectedVoiceType, selectedRangeId)}
            >
              Kampagne anlegen
            </button>
          </section>
        ) : (
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
            </section>

            <section className="campaign-panel" aria-label="Upgrade-Pfade">
              <div className="campaign-panel-header">
                <h2>Upgrade-Pfade</h2>
                <p>
                  Die Kampagne teilt sich in Notenpfad und Hilfsmittelpfad. Jeder
                  investierte Punkt verändert sofort die nächste Session.
                </p>
              </div>

              <div className="campaign-track-grid">
                <article className="campaign-track-card">
                  <span>Notenpfad</span>
                  <strong>
                    Effektive Übung {effectiveExerciseLevelIdx + 1} / {CAMPAIGN_PLAYABLE_LEVEL_COUNT}
                  </strong>
                  <p>
                    Zusatznoten-Slider: {progress.noteDifficultyPoints}
                  </p>
                </article>

                <article className="campaign-track-card">
                  <span>Klangstil-Hilfe</span>
                  <strong>
                    Slider: {progress.toneStyleDifficultyPoints}
                  </strong>
                  <p>
                    Tonstile aktiv: {aidSettings.toneStyleCount}
                  </p>
                </article>

                <article className="campaign-track-card">
                  <span>Farbhilfe</span>
                  <strong>
                    Slider: {progress.toneSplashDifficultyPoints}
                  </strong>
                  <p>
                    Farbhinweis-Modus: {aidSettings.toneSplashMode}
                  </p>
                </article>
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
                    Stimmtyp neu wählen
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

                  <label className="campaign-slider-row">
                    <span>Zusatznoten: {modalNoteLevel}</span>
                    <input
                      type="range"
                      min={0}
                      max={maxSliderLevel}
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
        )}
      </div>
    </main>
  )
}