import { useEffect, useState } from 'react'
import { api, getPlanId, setPlanId, getUserId, getUserEmail, setUserEmail } from '../api/client'

type PlanResp = {
  plan: { id: string; name: string; participant_user_ids: string[] }
  participants: { user_id: string; connected_accounts: number }[]
  share_url: string
}

type Readiness = {
  plan_id: string
  all_ready: boolean
  participants: { user_id: string; connected_accounts: number; ready: boolean }[]
}

export default function PlanPage() {
  const [name, setName] = useState('Brother-in-law Baseball Plan')
  const [joinId, setJoinId] = useState('')
  const [emailInput, setEmailInput] = useState(getUserEmail())
  const [plan, setPlan] = useState<PlanResp | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [message, setMessage] = useState('')

  const create = async () => {
    const p = await api<PlanResp>('/plans', 'POST', { name })
    setPlan(p)
    setPlanId(p.plan.id)
    setMessage('Plan created. Share the join link with the second person.')
    await refreshReadiness(p.plan.id)
  }

  const join = async (id?: string) => {
    const target = (id || joinId).trim()
    if (!target) return
    const p = await api<PlanResp>(`/plans/${target}/join`, 'POST')
    setPlan(p)
    setPlanId(p.plan.id)
    setMessage('Invite accepted. You joined the shared plan.')
    await refreshReadiness(p.plan.id)
  }

  const loadCurrent = async () => {
    const id = getPlanId()
    if (!id) return
    const p = await api<PlanResp>(`/plans/${id}`)
    setPlan(p)
    await refreshReadiness(id)
  }

  const refreshReadiness = async (id: string) => {
    const r = await api<Readiness>(`/plans/${id}/readiness`)
    setReadiness(r)
  }

  const saveIdentity = () => {
    if (!emailInput.trim()) return
    setUserEmail(emailInput)
    setMessage(`Signed in as ${emailInput.trim().toLowerCase()}.`)
  }

  const shareLink = plan ? `${window.location.origin}/plan?joinPlan=${plan.plan.id}` : ''

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('joinPlan')
    if (shared) {
      setJoinId(shared)
      join(shared)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section>
      <h2>Shared Plan</h2>
      <p><strong>Step 1:</strong> sign in with your email. The app uses this email as your account identity.</p>
      <div className="row">
        <input
          type="email"
          placeholder="you@example.com"
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
        />
        <button onClick={saveIdentity}>Save Email Identity</button>
      </div>
      <p className="meta">Current account: <code className="inline-code">{getUserId()}</code></p>

      <p><strong>Step 2:</strong> create a plan and share it.</p>
      <div className="row">
        <input value={name} onChange={e => setName(e.target.value)} />
        <button onClick={create}>Create New Plan</button>
      </div>

      <p><strong>Step 3:</strong> invitee opens the link (or pastes Plan ID) to accept and join.</p>
      <div className="row">
        <input placeholder="Paste plan id" value={joinId} onChange={e => setJoinId(e.target.value)} />
        <button className="secondary" onClick={() => join()}>Accept / Join Plan</button>
        <button className="secondary" onClick={loadCurrent}>Load My Current Plan</button>
      </div>

      {message && <p className="status info">{message}</p>}

      {plan && (
        <div>
          <h3>{plan.plan.name}</h3>
          <p>Plan ID: <code className="inline-code">{plan.plan.id}</code></p>
          <p>Share link: <code className="inline-code">{shareLink}</code></p>
          <h4>Participants</h4>
          <ul className="list">
            {plan.participants.map(p => <li key={p.user_id}>{p.user_id} ({p.connected_accounts} connected calendar provider(s))</li>)}
          </ul>
        </div>
      )}

      {readiness && (
        <div>
          <h4>Readiness</h4>
          <p className="meta">{readiness.all_ready ? '✅ All participants connected at least one calendar.' : '⚠️ Some participants still need to connect a calendar.'}</p>
          <ul className="list">
            {readiness.participants.map(p => <li key={p.user_id}>{p.user_id}: {p.ready ? 'ready' : 'not ready'}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
