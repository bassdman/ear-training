import { NavLink, Outlet } from 'react-router-dom'

import './intonationExercisesPage.css'

export function IntonationExercisesLayout() {
  return (
    <main className="ie-page">
      <div className="ie-shell">
        <NavLink className="ie-back" to="/">
          Zurück
        </NavLink>
        <h1>Intonationsübungen</h1>

        <nav className="ie-nav" aria-label="Bereiche">
          <NavLink to="/intonation-exercises/practice">Üben</NavLink>
          <NavLink to="/intonation-exercises/songs">Lieder</NavLink>
          <NavLink to="/intonation-exercises/create">Erstellen</NavLink>
        </nav>

        <Outlet />
      </div>
    </main>
  )
}
