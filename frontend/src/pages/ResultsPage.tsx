import { useState } from 'react'
import { api, getPlanId } from '../api/client'

export default function ResultsPage() {
  const [data, setData] = useState<any | null>(null)
  const [showExplain, setShowExplain] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    try {
      setError('')
      const prefs = await api<any>('/preferences')
      const results = await api<any>('/search', 'POST', { preferences: prefs, plan_id: getPlanId() })
      setData(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    }
  }

  return (
    <section>
      <h2>Results</h2>
      <p>Current shared plan: {getPlanId() || 'none'}</p>
      <p>Tip: if you run shared search and get an error, make sure each participant connected at least one calendar in Connect Calendars.</p>
      <button onClick={run}>Run Search</button>
      <button onClick={() => setShowExplain(!showExplain)}>Explain scoring</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {showExplain && data && (
        <div className="modal">
          {Object.entries(data.scoring_weights).map(([k, v]) => <p key={k}>{k}: {String(v)}</p>)}
        </div>
      )}
      <h3>Top 3</h3>
      <div className="cards">
        {data?.top_three?.map((r: any) => (
          <article key={r.game.game_id} className="card">
            <h4>{r.game.team} vs {r.game.opponent}</h4>
            <p>{new Date(r.game.start_time_utc).toLocaleString()}</p>
            <p>Estimated total: ${r.ticket_summary.estimated_total}</p>
            <p>{r.game.giveaway_text || 'No giveaway listed'}</p>
            <ul>{r.why_recommended.map((w: string) => <li key={w}>{w}</li>)}</ul>
            <a href={r.ticket_summary.deep_link} target="_blank">View tickets</a>
          </article>
        ))}
      </div>
      <h3>Ranked list</h3>
      <table>
        <thead><tr><th>Game</th><th>Score</th><th>Price</th><th>Link</th></tr></thead>
        <tbody>
          {data?.ranked?.map((r: any) => (
            <tr key={r.game.game_id}>
              <td>{r.game.team} vs {r.game.opponent}</td>
              <td>{r.score}</td>
              <td>${r.ticket_summary.estimated_total}</td>
              <td><a href={r.ticket_summary.deep_link} target="_blank">Tickets</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
