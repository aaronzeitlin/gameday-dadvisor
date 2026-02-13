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
  const [pendingJoinPlan, setPendingJoinPlan] = useState<string | null>(null)

  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email.trim())
  const [loadingAction, setLoadingAction] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const refreshReadiness = async (id: string, showSuccessMessage = false) => {
    try {
      const r = await api<Readiness>(`/plans/${id}/readiness`)
      setReadiness(r)
      if (showSuccessMessage) {
        setMessage('Readiness refreshed.')
      }
    } catch {
      setErrorMessage('We could not refresh readiness right now. Please try again.')
    }
  }

  const create = async () => {
    setLoadingAction('create')
    setErrorMessage('')
    try {
      const p = await api<PlanResp>('/plans', 'POST', { name })
      setPlan(p)
      setPlanId(p.plan.id)
      await refreshReadiness(p.plan.id)
      setMessage('Plan created. Share the join link with the second person.')
    } catch {
      setErrorMessage('We could not create your plan right now. Please try again.')
    } finally {
      setLoadingAction('')
    }
  }

  const join = async (id?: string) => {
    const target = (id || joinId).trim()
    if (!target) return
    const p = await api<PlanResp>(`/plans/${target}/join`, 'POST')
    const joiningUser = getUserId()
    setPlan(p)
    setPlanId(p.plan.id)
    setPendingJoinPlan(null)
    setMessage(`Invite accepted. ${joiningUser} joined plan ${p.plan.id}.`)
    await refreshReadiness(p.plan.id)
    setLoadingAction('join')
    setErrorMessage('')
    try {
      const p = await api<PlanResp>(`/plans/${target}/join`, 'POST')
      setPlan(p)
      setPlanId(p.plan.id)
      await refreshReadiness(p.plan.id)
      setMessage('Plan joined successfully. You are now in the shared plan.')
    } catch {
      setErrorMessage('We could not join that plan. Check the plan ID and try again.')
    } finally {
      setLoadingAction('')
    }
  }

  const loadCurrent = async () => {
    const id = getPlanId()
    if (!id) return
    setLoadingAction('loadCurrent')
    setErrorMessage('')
    try {
      const p = await api<PlanResp>(`/plans/${id}`)
      setPlan(p)
      await refreshReadiness(id)
      setMessage('Loaded your current plan.')
    } catch {
      setErrorMessage('We could not load your current plan right now. Please try again.')
    } finally {
      setLoadingAction('')
    }
  }

  const handleRefreshReadiness = async () => {
    const id = plan?.plan.id || getPlanId()
    if (!id) return
    setLoadingAction('refreshReadiness')
    setErrorMessage('')
    try {
      await refreshReadiness(id, true)
    } finally {
      setLoadingAction('')
    }
  }

  const saveIdentity = async () => {
    const normalized = emailInput.trim().toLowerCase()
    if (!isValidEmail(normalized)) return
    setUserEmail(normalized)

    if (pendingJoinPlan) {
      await join(pendingJoinPlan)
      return
    }

    setMessage(`Signed in as ${normalized}.`)
  }

  const shareLink = plan ? `${window.location.origin}/plan?joinPlan=${plan.plan.id}` : ''
  const isLoading = Boolean(loadingAction)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('joinPlan')
    if (shared) {
      setJoinId(shared)
      const email = getUserEmail()
      if (isValidEmail(email)) {
        join(shared)
      } else {
        setPendingJoinPlan(shared)
      }
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
          disabled={isLoading}
        />
        <button onClick={saveIdentity} disabled={isLoading}>Save Email Identity</button>
      </div>
      {pendingJoinPlan && <p className="status warning">Save your email identity before joining this plan.</p>}
      <p className="meta">Current account: <code className="inline-code">{getUserId()}</code></p>

      <p><strong>Step 2:</strong> create a plan and share it.</p>
      <div className="row">
        <input value={name} onChange={e => setName(e.target.value)} disabled={isLoading} />
        <button onClick={create} disabled={isLoading}>Create New Plan</button>
      </div>

      <p><strong>Step 3:</strong> invitee opens the link (or pastes Plan ID) to accept and join.</p>
      <div className="row">
        <input placeholder="Paste plan id" value={joinId} onChange={e => setJoinId(e.target.value)} disabled={isLoading} />
        <button className="secondary" onClick={() => join()} disabled={isLoading}>Accept / Join Plan</button>
        <button className="secondary" onClick={loadCurrent} disabled={isLoading}>Load My Current Plan</button>
        <button className="secondary" onClick={handleRefreshReadiness} disabled={isLoading || !plan}>Refresh Readiness</button>
      </div>

      {message && <p className="status info">{message}</p>}
      {errorMessage && <p className="status error">{errorMessage}</p>}

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
