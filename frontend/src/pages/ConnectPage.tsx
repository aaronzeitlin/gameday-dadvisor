import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { uiState } from '../ui-state'

type Account = { provider: string; account_email: string; created_at: string }
type PlanResp = { participants: { user_id: string; connected_accounts: number }[] }

export default function ConnectPage() {
  const [email, setEmail] = useState(uiState.snapshot().signedInEmail || 'alice@example.com')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [participants, setParticipants] = useState<PlanResp['participants']>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const me = await api<{ connected_accounts: Account[] }>('/me')
    setAccounts(me.connected_accounts)
    const planId = uiState.snapshot().currentPlanId
    if (planId) {
      const plan = await api<PlanResp & { plan: { id: string } }>(`/plans/${planId}`)
      setParticipants(plan.participants)
    }
  }

  useEffect(() => { load().catch(() => undefined) }, [])

  const connect = async (provider: 'google' | 'microsoft') => {
    setLoading(true)
    setError('')
    try {
      uiState.setSignedInEmail(email)
      await api(`/auth/${provider}/callback?account_email=${encodeURIComponent(email.trim().toLowerCase())}`, 'POST')
      await load()
      uiState.addToast(`${provider} calendar connected`)
    } catch {
      setError('Could not connect account. Try sample emails alice@example.com or bob@example.com.')
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async (provider: string) => {
    setLoading(true)
    try {
      await api(`/disconnect/${provider}`, 'POST')
      await load()
      uiState.addToast(`${provider} disconnected`, 'warning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel stack">
      <div>
        <h2>Connect Calendars</h2>
        <p className="muted">Use mock emails for dev: alice@example.com or bob@example.com.</p>
      </div>

      <div className="grid-2">
        <article className="card stack">
          <h3>Connect a provider</h3>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Calendar account email" />
          <div className="row">
            <button className="btn btn-primary" disabled={loading} onClick={() => connect('google')}>Connect Google</button>
            <button className="btn btn-secondary" disabled={loading} onClick={() => connect('microsoft')}>Connect Microsoft</button>
          </div>
          {error && <p className="inline-error">{error}</p>}
        </article>

        <article className="card stack">
          <h3>Your connected accounts</h3>
          {accounts.length === 0 && <p className="muted">No calendars connected yet.</p>}
          {accounts.map(acc => (
            <div key={`${acc.provider}-${acc.account_email}`} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{acc.provider} · {acc.account_email}</span>
              <button className="btn btn-secondary" disabled={loading} onClick={() => disconnect(acc.provider)}>Disconnect</button>
            </div>
          ))}
        </article>
      </div>

      <article className="card stack">
        <h3>Plan participant status</h3>
        {!uiState.snapshot().currentPlanId && <p className="muted">Join or create a plan to view participant readiness.</p>}
        {participants.map(person => (
          <div className="row" key={person.user_id} style={{ justifyContent: 'space-between' }}>
            <span>{person.user_id}</span>
            <span className={`pill ${person.connected_accounts > 0 ? 'success' : 'warning'}`}>
              {person.connected_accounts > 0 ? 'Connected' : 'Missing'}
            </span>
          </div>
        ))}
      </article>
    </section>
  )
}
