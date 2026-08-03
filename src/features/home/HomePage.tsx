import { Link } from 'react-router-dom'

import './homePage.css'

export function HomePage() {
  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="home-hero">
          <p className="home-kicker">Ear Training</p>
          <h1>Wie willst du dein Gehör trainieren?</h1>
        </header>

        <section className="home-grid" aria-label="Trainingsmodi">
          <article className="home-card">
            <h2>Kampagne</h2>
            <p>
              Starte über deinen Stimmtyp, lege den Einstiegspunkt fest und verfolge den
              sichtbaren Pfad über 80 Schritte.
            </p>
            <Link className="home-link" to="/campaign">
              Zur Kampagne
            </Link>
          </article>

          <article className="home-card">
            <h2>Freie Übungen</h2>
            <p>
              Trainiere weiterhin kategoriebasiert nach Lage und Schwierigkeitsgrad.
            </p>
            <Link className="home-link is-secondary" to="/course">
              Zu den Übungen
            </Link>
          </article>
        </section>
      </div>
    </main>
  )
}