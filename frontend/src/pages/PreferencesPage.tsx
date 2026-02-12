import { useEffect, useState } from 'react'
import { api } from '../api/client'

const now = new Date()
const plus90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000)

export default function PreferencesPage() {
  const [form, setForm] = useState({
    team_text: 'Yankees',
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
    api<any>('/preferences').then(p => setForm({ ...form, ...p }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    await api('/preferences', 'PUT', { preferences: form })
    alert('Saved')
  }

  return (
    <section>
      <h2>Preferences</h2>
      <label>Team <input value={form.team_text} onChange={e => setForm({ ...form, team_text: e.target.value })} /></label>
      <label>Party Size <input type="number" value={form.party_size} onChange={e => setForm({ ...form, party_size: Number(e.target.value) })} /></label>
      <label>Budget Total <input type="number" value={form.budget_total} onChange={e => setForm({ ...form, budget_total: Number(e.target.value) })} /></label>
      <label>Price Tier <input type="range" min={0} max={1} step={0.1} value={form.price_tier} onChange={e => setForm({ ...form, price_tier: Number(e.target.value) })} /></label>
      <label>Giveaway Only <input type="checkbox" checked={form.giveaway_only} onChange={e => setForm({ ...form, giveaway_only: e.target.checked })} /></label>
      <button onClick={save}>Save Preferences</button>
    </section>
  )
}
