import { Link, Navigate, Route, Routes } from 'react-router-dom'
import ConnectPage from './pages/ConnectPage'
import PreferencesPage from './pages/PreferencesPage'
import PlanPage from './pages/PlanPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <div className="container">
      <header className="app-header">
        <h1>Gameday Dadvisor</h1>
        <p className="subtitle">Email-based shared planning for game nights.</p>
      </header>
      <nav>
        <Link to="/plan">Plan</Link>
        <Link to="/connect">Connect Calendars</Link>
        <Link to="/preferences">Preferences</Link>
        <Link to="/results">Results</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/plan" replace />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </div>
  )
}
