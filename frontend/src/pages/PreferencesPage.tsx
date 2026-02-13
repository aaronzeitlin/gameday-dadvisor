import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const now = new Date()
const plus90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000)

const TEAM_OPTIONS = ['Seattle Mariners', 'New York Yankees', 'Los Angeles Dodgers', 'Chicago Cubs', 'Houston Astros']

export default function PreferencesPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    team_text: TEAM_OPTIONS[0],
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

  useEffect(() => {
    api<any>('/preferences').then(server => setForm(cur => ({ ...cur, ...server }))).catch(() => undefined)
  }, [])

  const save = async (continueToResults = false) => {
    setSaving(true)
    setError('')
    try {
      await api('/preferences', 'PUT', { preferences: form })
      if (continueToResults) navigate('/results')
    } catch {
      setError('Could not save preferences.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel stack">
      <div>
        <h2>Preferences</h2>
        <p className="muted">Tune your ideal game, then run ranking on Results.</p>
      </div>

      <div className="grid-3">
        <label>Team<select value={form.team_text} onChange={e => setForm({ ...form, team_text: e.target.value })}>{TEAM_OPTIONS.map(team => <option key={team} value={team}>{team}</option>)}</select></label>
        <label>Party size<input type="number" min={1} value={form.party_size} onChange={e => setForm({ ...form, party_size: Number(e.target.value) })} /></label>
        <label>Budget total<input type="number" min={0} value={form.budget_total} onChange={e => setForm({ ...form, budget_total: Number(e.target.value) })} /></label>
        <label>Date start<input type="datetime-local" value={form.date_start.slice(0, 16)} onChange={e => setForm({ ...form, date_start: new Date(e.target.value).toISOString() })} /></label>
        <label>Date end<input type="datetime-local" value={form.date_end.slice(0, 16)} onChange={e => setForm({ ...form, date_end: new Date(e.target.value).toISOString() })} /></label>
        <label>Price tier ({form.price_tier})<input type="range" min={0} max={1} step={0.1} value={form.price_tier} onChange={e => setForm({ ...form, price_tier: Number(e.target.value) })} /></label>
      </div>

      <label className="row"><input type="checkbox" checked={form.giveaway_only} onChange={e => setForm({ ...form, giveaway_only: e.target.checked })} style={{ width: 'auto' }} />Giveaway games only</label>
      {error && <p className="inline-error">{error}</p>}
      <div className="row">
        <button className="btn btn-secondary" disabled={saving} onClick={() => save(false)}>Save</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>Save & view results</button>
      </div>
    </section>
  )
}
