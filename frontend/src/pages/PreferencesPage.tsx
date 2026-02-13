import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getPlanId } from '../api/client'

const now = new Date()
const plus90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000)

const LEAGUE_TEAMS: Record<string, string[]> = {
  MLB: ['Seattle Mariners', 'New York Yankees', 'Los Angeles Dodgers', 'Chicago Cubs', 'Houston Astros'],
  NFL: ['Seattle Seahawks', 'San Francisco 49ers', 'Dallas Cowboys', 'Kansas City Chiefs', 'Philadelphia Eagles'],
  NBA: ['Los Angeles Lakers', 'Boston Celtics', 'Golden State Warriors', 'Miami Heat', 'New York Knicks'],
  NHL: ['Seattle Kraken', 'Vegas Golden Knights', 'New York Rangers', 'Colorado Avalanche', 'Toronto Maple Leafs']
}

const DEFAULT_LEAGUE = 'MLB'
const DEFAULT_TEAM = 'Seattle Mariners'

const inferLeague = (teamText?: string | null) => {
  if (!teamText) return DEFAULT_LEAGUE
  const foundLeague = Object.entries(LEAGUE_TEAMS).find(([, teams]) => teams.includes(teamText))
  return foundLeague?.[0] ?? DEFAULT_LEAGUE
}

export default function PreferencesPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    team_text: DEFAULT_TEAM,
    date_start: now.toISOString(),
    date_end: plus90.toISOString(),
    party_size: 2,
    budget_total: 250,
    price_tier: 0.4,
    giveaway_only: false,
    giveaway_keywords: ['bobblehead'],
    dow_prefs: [],
    tod_prefs: ['evening'],
    zip_code: '10001',
    max_miles: 50,
    buffer_before_mins: 60,
    buffer_after_mins: 90,
    exclude_back_to_back_late_nights: false
  })
  const [league, setLeague] = useState(DEFAULT_LEAGUE)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<any>('/preferences').then(p => {
      const merged = { ...form, ...p }
      setForm(merged)
      setLeague(inferLeague(merged.team_text))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/preferences', 'PUT', { preferences: form })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving preferences failed')
    } finally {
      setSaving(false)
    }
  }

  const saveAndContinue = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/preferences', 'PUT', { preferences: form })
      navigate('/results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving preferences failed')
    } finally {
      setSaving(false)
    }
  }

  const teamsForLeague = LEAGUE_TEAMS[league]

  return (
    <section>
      <h2>Preferences</h2>
      <p className="meta">Pick your filters, then continue to Results to run and review recommendations.</p>
      <p className="meta">Current shared plan: <code className="inline-code">{getPlanId() || 'none'}</code></p>

      <div className="prefs-grid">
        <label>
          League
          <select
            value={league}
            onChange={e => {
              const selectedLeague = e.target.value
              setLeague(selectedLeague)
              setForm({ ...form, team_text: LEAGUE_TEAMS[selectedLeague][0] })
            }}
          >
            {Object.keys(LEAGUE_TEAMS).map(leagueName => (
              <option key={leagueName} value={leagueName}>
                {leagueName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Team
          <select value={form.team_text} onChange={e => setForm({ ...form, team_text: e.target.value })}>
            {teamsForLeague.map(team => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>

        <label>Party Size <input type="number" value={form.party_size} onChange={e => setForm({ ...form, party_size: Number(e.target.value) })} /></label>
        <label>Budget Total <input type="number" value={form.budget_total} onChange={e => setForm({ ...form, budget_total: Number(e.target.value) })} /></label>
        <label>
          Price Tier
          <input type="range" min={0} max={1} step={0.1} value={form.price_tier} onChange={e => setForm({ ...form, price_tier: Number(e.target.value) })} />
        </label>
        <label><input type="checkbox" checked={form.giveaway_only} onChange={e => setForm({ ...form, giveaway_only: e.target.checked })} />Giveaway Only</label>
      </div>

      <div className="row">
        <button className="secondary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Preferences'}</button>
        <button onClick={saveAndContinue} disabled={saving}>{saving ? 'Saving...' : 'Continue to Results'}</button>
      </div>

      {error && <p className="status error">{error}</p>}
    </section>
  )
}
