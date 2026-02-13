import { useEffect, useMemo, useState } from 'react'
import { api, getPlanId } from '../api/client'

const now = new Date()
const plus90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000)

type ViewMode = 'cards' | 'week' | 'calendar'

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

const weekdayName = (isoTime: string) => new Date(isoTime).toLocaleDateString(undefined, { weekday: 'long' })
const dayLabel = (isoTime: string) => new Date(isoTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

type SearchResult = {
  score: number
  game: { game_id: string; team: string; opponent: string; start_time_utc: string; giveaway_text?: string }
  ticket_summary: { estimated_total: number; deep_link: string }
  why_recommended: string[]
}

export default function PreferencesPage() {
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
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

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
    try {
      await api('/preferences', 'PUT', { preferences: form })
    } finally {
      setSaving(false)
    }
  }

  const saveAndRun = async () => {
    try {
      setLoading(true)
      setError('')
      await api('/preferences', 'PUT', { preferences: form })
      const results = await api<any>('/search', 'POST', { preferences: form, plan_id: getPlanId() })
      setData(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const teamsForLeague = LEAGUE_TEAMS[league]

  const ranked: SearchResult[] = useMemo(() => data?.ranked ?? [], [data])
  const noMatches = Boolean(data) && ranked.length === 0
  const groupedByWeekday = useMemo(() => {
    return ranked.reduce<Record<string, SearchResult[]>>((acc, result) => {
      const key = weekdayName(result.game.start_time_utc)
      acc[key] = [...(acc[key] ?? []), result]
      return acc
    }, {})
  }, [ranked])

  return (
    <section>
      <h2>Plan + Results</h2>
      <p className="meta">Pick your filters, then generate game options instantly below in your preferred layout.</p>
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
          Price Tier ({form.price_tier.toFixed(1)})
          <input type="range" min={0} max={1} step={0.1} value={form.price_tier} onChange={e => setForm({ ...form, price_tier: Number(e.target.value) })} />
        </label>
        <label><input type="checkbox" checked={form.giveaway_only} onChange={e => setForm({ ...form, giveaway_only: e.target.checked })} />Giveaway Only</label>
      </div>

      <div className="row">
        <button className="secondary" onClick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save Preferences'}</button>
        <button onClick={saveAndRun} disabled={loading}>{loading ? 'Generating...' : 'Generate Results'}</button>
      </div>

      {error && <p className="status error">{error}</p>}

      {data && (
        <>
          {noMatches ? (
            <div className="status info" role="status" aria-live="polite">
              <strong>No matching games found for current filters.</strong>
              <ul className="list">
                <li>Expand your date range.</li>
                <li>Increase your budget total.</li>
                <li>Disable giveaway-only filtering.</li>
                <li>Verify all participants connected their calendars.</li>
              </ul>
            </div>
          ) : (
            <>
              <div className="row view-toggle">
                <strong>Result View:</strong>
                <button className={viewMode === 'cards' ? '' : 'secondary'} onClick={() => setViewMode('cards')}>Card List</button>
                <button className={viewMode === 'week' ? '' : 'secondary'} onClick={() => setViewMode('week')}>Weekly</button>
                <button className={viewMode === 'calendar' ? '' : 'secondary'} onClick={() => setViewMode('calendar')}>Calendar</button>
              </div>

              {viewMode === 'cards' && (
                <div className="cards">
                  {ranked.map(r => (
                    <article key={r.game.game_id} className="card">
                      <h4>{r.game.team} vs {r.game.opponent}</h4>
                      <p>{new Date(r.game.start_time_utc).toLocaleString()}</p>
                      <p>Score: {r.score.toFixed(2)}</p>
                      <p>Estimated total: ${r.ticket_summary.estimated_total}</p>
                      <p>{r.game.giveaway_text || 'No giveaway listed'}</p>
                      <ul className="list">{r.why_recommended.map(w => <li key={w}>{w}</li>)}</ul>
                      <a href={r.ticket_summary.deep_link} target="_blank" rel="noreferrer">View tickets</a>
                    </article>
                  ))}
                </div>
              )}

              {viewMode === 'week' && (
                <div className="week-grid">
                  {Object.entries(groupedByWeekday).map(([day, games]) => (
                    <article key={day} className="card">
                      <h4>{day}</h4>
                      <ul className="list">
                        {games.map(game => (
                          <li key={game.game.game_id}>
                            {dayLabel(game.game.start_time_utc)} · {game.game.team} vs {game.game.opponent} (${game.ticket_summary.estimated_total})
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}

              {viewMode === 'calendar' && (
                <table>
                  <thead><tr><th>Date</th><th>Matchup</th><th>Score</th><th>Price</th><th>Link</th></tr></thead>
                  <tbody>
                    {ranked.map(r => (
                      <tr key={r.game.game_id}>
                        <td>{new Date(r.game.start_time_utc).toLocaleDateString()}</td>
                        <td>{r.game.team} vs {r.game.opponent}</td>
                        <td>{r.score.toFixed(2)}</td>
                        <td>${r.ticket_summary.estimated_total}</td>
                        <td><a href={r.ticket_summary.deep_link} target="_blank" rel="noreferrer">Tickets</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
