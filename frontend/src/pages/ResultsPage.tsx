import { useState } from 'react'
import { api } from '../api/client'
import { uiState } from '../ui-state'

type SearchResult = {
  score: number
  why_recommended: string[]
  game: { game_id: string; team: string; opponent: string; start_time_utc: string; giveaway_text?: string | null; venue?: string }
  ticket_summary: { estimated_total: number; deep_link: string; min_price?: number; median_price?: number }
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<{ ranked: SearchResult[]; top_three: SearchResult[] } | null>(null)

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const prefs = await api<any>('/preferences')
      const results = await api<any>('/search', 'POST', { preferences: prefs, plan_id: uiState.snapshot().currentPlanId || null })
      setData(results)
      if ((results?.ranked || []).length === 0) {
        uiState.addToast('No matches. Try widening dates or budget.', 'warning')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const ranked = data?.ranked || []

  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Results</h2>
          <p className="muted">Recommendations ranked by availability, value, and fit.</p>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading}>{loading ? 'Ranking games…' : 'Generate recommendations'}</button>
      </div>

      {loading && <div className="skeleton" aria-hidden="true" />}
      {error && <p className="inline-error">{error}</p>}

      {!loading && data && ranked.length === 0 && (
        <article className="card stack">
          <h3>No results yet</h3>
          <p className="muted">Possible causes: no overlapping calendar availability, or filters are too strict.</p>
          <ul>
            <li>Confirm both participants connected at least one calendar.</li>
            <li>Expand date range or increase budget total.</li>
            <li>Turn off giveaway-only mode.</li>
          </ul>
        </article>
      )}

      <div className="stack">
        {ranked.map((item, idx) => (
          <article className="card result-card" key={item.game.game_id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>#{idx + 1} {item.game.team} vs {item.game.opponent}</h3>
              <span className="pill info">Score {item.score.toFixed(2)}</span>
            </div>
            <p className="muted">{new Date(item.game.start_time_utc).toLocaleString()} · {item.game.venue || 'Venue TBA'}</p>
            <p><strong>Estimated total:</strong> ${item.ticket_summary?.estimated_total ?? 'unknown'}</p>
            <p>{item.game.giveaway_text || 'No giveaway listed.'}</p>
            <ul>
              {item.why_recommended.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
            <a className="btn btn-secondary" href={item.ticket_summary.deep_link} target="_blank" rel="noreferrer">View tickets</a>
          </article>
        ))}
      </div>
    </section>
  )
}
