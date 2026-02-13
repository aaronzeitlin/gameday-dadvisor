import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { uiState } from '../ui-state'

type Participant = { user_id: string; connected_accounts: number; ready?: boolean }
type PlanResp = {
  plan: { id: string; name: string; participant_user_ids: string[] }
  participants: Participant[]
  share_url: string
}

export default function PlanPage() {
  const [email, setEmail] = useState(uiState.snapshot().signedInEmail)
  const [planName, setPlanName] = useState('Brother-in-law Baseball Plan')
  const [joinId, setJoinId] = useState(uiState.parseJoinPlanFromUrl() || '')
  const [plan, setPlan] = useState<PlanResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidEmail = /\S+@\S+\.\S+/

  const loadPlan = async (planId: string) => {
    const payload = await api<PlanResp>(`/plans/${planId}`)
    setPlan(payload)
    uiState.setPlanId(payload.plan.id)
  }

  const createPlan = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await api<PlanResp>('/plans', 'POST', { name: planName })
      setPlan(payload)
      uiState.setPlanId(payload.plan.id)
      setJoinId(payload.plan.id)
      uiState.addToast('Plan created. Share the invite link.')
    } catch {
      setError('Could not create plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const joinPlan = async (id = joinId) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const payload = await api<PlanResp>(`/plans/${id}/join`, 'POST')
      setPlan(payload)
      uiState.setPlanId(payload.plan.id)
      uiState.addToast(`Joined ${payload.plan.name}`)
    } catch {
      setError('Plan ID not found or invite expired.')
    } finally {
      setLoading(false)
    }
  }

  const saveIdentity = async () => {
    if (!isValidEmail.test(email.trim().toLowerCase())) {
      setError('Enter a valid email to continue.')
      return
    }
    uiState.setSignedInEmail(email)
    uiState.addToast(`Signed in as ${email.trim().toLowerCase()}`)
    if (joinId) await joinPlan(joinId)
  }

  useEffect(() => {
    const planId = uiState.snapshot().currentPlanId
    if (planId) loadPlan(planId).catch(() => undefined)
    if (joinId && uiState.snapshot().signedInEmail) joinPlan(joinId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shareLink = plan ? `${window.location.origin}/plan?joinPlan=${plan.plan.id}` : ''
  const checklist = useMemo(() => uiState.readinessChecklist(plan?.participants || []), [plan])

  return (
    <section className="panel stack">
      <div>
        <h2>Plan Setup</h2>
        <p className="muted">Sign in with email, create a plan, and share a join link.</p>
      </div>

      <div className="grid-2">
        <article className="card stack">
          <h3>1) Identity</h3>
          <input type="email" placeholder="alice@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn btn-primary" onClick={saveIdentity} disabled={loading}>Save Email Identity</button>
          <p className="muted">Email is your account identity. Backend also maps it to X-User-Id.</p>
        </article>

        <article className="card stack">
          <h3>2) Create or Join</h3>
          <input value={planName} onChange={e => setPlanName(e.target.value)} aria-label="Plan name" />
          <button className="btn btn-primary" onClick={createPlan} disabled={loading}>Create Plan</button>
          <input placeholder="Paste Plan ID" value={joinId} onChange={e => setJoinId(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => joinPlan()} disabled={loading}>Join Plan</button>
        </article>
      </div>

      {error && <p className="inline-error">{error}</p>}

      <article className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>3) Participants & readiness</h3>
          {shareLink && <button className="btn btn-secondary" onClick={() => uiState.copyText(shareLink).then(() => uiState.addToast('Invite link copied'))}>Copy invite link</button>}
        </div>
        {!plan && <p className="muted">No plan yet. Create one to start shared planning.</p>}
        {plan && (
          <>
            <p className="muted"><strong>{plan.plan.name}</strong> · Plan ID: {plan.plan.id}</p>
            <div className="stack">
              {plan.participants.map(person => (
                <div key={person.user_id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{person.user_id}</span>
                  <span className={`pill ${person.connected_accounts > 0 ? 'success' : 'warning'}`}>
                    {person.connected_accounts > 0 ? 'Connected' : 'Missing calendar'}
                  </span>
                </div>
              ))}
            </div>
            <p className="muted">Checklist: {checklist.connected}/{checklist.total} participants connected calendars.</p>
          </>
        )}
      </article>
    </section>
  )
}
