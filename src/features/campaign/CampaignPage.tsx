import { useMemo, useState } from 'react'

import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  CAMPAIGN_RANGES,
  CAMPAIGN_VOICE_TYPES,
  CAMPAIGN_VOICE_TYPE_IDS,
} from './config'
import './campaignPage.css'
import { useCampaignProgress } from './hooks/useCampaignProgress'
import type { CampaignRangeId, CampaignVoiceType } from './types'

type CampaignPageProps = {
  onBackHome: () => void
  onOpenExercises: () => void
  onOpenTrainer: () => void
}

export function CampaignPage({ onBackHome, onOpenExercises, onOpenTrainer }: CampaignPageProps) {
  const { loaded, progress, hasProfile, setProfile, allocatePoint, resetProfile } = useCampaignProgress()
  const [selectedVoiceType, setSelectedVoiceType] = useState<CampaignVoiceType>('bass')

  const selectedVoice = CAMPAIGN_VOICE_TYPES[selectedVoiceType]
  const selectedRangeId = (selectedVoice.startRangeOptions[0] ?? 'male-low') as CampaignRangeId

  const pathLevels = useMemo(
    () => Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, levelIdx) => levelIdx),
    [],
  )
  const allocatedPoints = progress.noteUpgradePoints + progress.aidReductionPoints
  const pendingPoints = Math.max(0, progress.spentPoints - allocatedPoints)
  const aidReductionAtMax = progress.aidReductionPoints >= 2

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
                <span>Schwierigkeitspunkte</span>
                <strong>{progress.spentPoints}</strong>
              </div>
              <div className="campaign-summary-card">
                <span>Investiert</span>
                <strong>
                  Noten {progress.noteUpgradePoints} · Hilfen {progress.aidReductionPoints}
                </strong>
              </div>
            </section>

            {pendingPoints > 0 && (
              <section className="campaign-panel" aria-label="Punkte verteilen">
                <div className="campaign-panel-header">
                  <h2>Punkte verteilen</h2>
                  <p>
                    Du hast {pendingPoints} neuen Punkt{pendingPoints > 1 ? 'e' : ''}.
                    Wähle vor der nächsten Runde, ob du mehr Noten freischaltest oder
                    Hilfsmittel reduzierst.
                  </p>
                </div>
                <div className="campaign-upgrade-actions">
                  <button className="campaign-primary-button" onClick={() => allocatePoint('notes')}>
                    Mehr Noten freischalten
                  </button>
                  <button
                    className="campaign-reset-button"
                    onClick={() => allocatePoint('aids')}
                    disabled={aidReductionAtMax}
                  >
                    Hilfsmittel reduzieren
                  </button>
                </div>
              </section>
            )}

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
                  const isUnlocked = levelIdx <= progress.unlockedLevelIdx
                  const stateClass = isCurrent
                    ? 'is-current'
                    : isUnlocked
                      ? 'is-unlocked'
                      : 'is-locked'

                  return (
                    <div
                      key={levelIdx}
                      className={`campaign-path-node ${stateClass}`}
                      aria-label={`Level ${levelIdx + 1}`}
                    >
                      <span>{levelIdx + 1}</span>
                    </div>
                  )
                })}
              </div>

              <div className="campaign-footnote">
                <div>
                  <p>Spielbar ist jetzt der erste Start-Lagen-Abschnitt mit den ersten {CAMPAIGN_PLAYABLE_LEVEL_COUNT} Schritten.</p>
                  <p>
                    Jeder neu freigeschaltete Schritt erhöht den aktuellen Kampagnenstand.
                    Die Upgrade-Auswahl folgt im nächsten Schritt.
                  </p>
                </div>
                <div className="campaign-footnote-actions">
                  <button
                    className="campaign-primary-button"
                    onClick={onOpenTrainer}
                    disabled={pendingPoints > 0}
                  >
                    Aktuellen Schritt spielen
                  </button>
                  <button className="campaign-reset-button" onClick={resetProfile}>
                    Stimmtyp neu wählen
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}