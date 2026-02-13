import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import ConnectPage from './pages/ConnectPage'
import PreferencesPage from './pages/PreferencesPage'
import PlanPage from './pages/PlanPage'
import ResultsPage from './pages/ResultsPage'
import { uiState } from './ui-state'

const tabs = [
  { to: '/plan', label: 'Plan' },
  { to: '/connect', label: 'Connect Calendars' },
  { to: '/preferences', label: 'Preferences' },
  { to: '/results', label: 'Results' }
]

export default function App() {
  const state = useSyncExternalStore<ReturnType<typeof uiState.snapshot>>(uiState.subscribe, uiState.snapshot)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <h1>Gameday Dadvisor MVP</h1>
          <p>Find games both of you can make, then grab tickets fast.</p>
        </div>
        <aside className="identity" aria-live="polite">
          <div><strong>Signed in:</strong> {state.signedInEmail || 'Not signed in'}</div>
          <div><strong>Plan:</strong> {state.currentPlanId || 'No plan selected'}</div>
        </aside>
      </header>

      <nav className="tabs" aria-label="Primary">
        {tabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/plan" replace />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>

      <div className="toast-region" role="status" aria-live="polite">
        {state.toasts.map(toast => (
          <div key={toast.id} className="toast">{toast.message}</div>
        ))}
      </div>
    </div>
  )
}
