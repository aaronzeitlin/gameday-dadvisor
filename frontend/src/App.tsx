import { Link, Route, Routes } from 'react-router-dom'
import ConnectPage from './pages/ConnectPage'
import PreferencesPage from './pages/PreferencesPage'
import PlanPage from './pages/PlanPage'

export default function App() {
  return (
    <div className="container">
      <header className="app-header">
        <h1>Gameday Dadvisor</h1>
        <p className="subtitle">Simple planning for shared game nights.</p>
      </header>
      <nav>
        <Link to="/plan">Plan</Link>
        <Link to="/">Connect Calendars</Link>
        <Link to="/preferences">Plan + Results</Link>
      </nav>
      <Routes>
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/" element={<ConnectPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/results" element={<PreferencesPage />} />
      </Routes>
    </div>
  )
}
