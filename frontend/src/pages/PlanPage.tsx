import { useEffect, useState } from 'react'
import { api, getPlanId, setPlanId, getUserId, setUserId } from '../api/client'

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
  const [userIdInput, setUserIdInput] = useState(getUserId())
  const [plan, setPlan] = useState<PlanResp | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [message, setMessage] = useState('')

  const create = async () => {
    const p = await api<PlanResp>('/plans', 'POST', { name })
    setPlan(p)
    setPlanId(p.plan.id)
    setMessage('Plan created. Share the link with your second person.')
    await refreshReadiness(p.plan.id)
  }

  const join = async (id?: string) => {
    const target = (id || joinId).trim()
    if (!target) return
    const p = await api<PlanResp>(`/plans/${target}/join`, 'POST')
    setPlan(p)
    setPlanId(p.plan.id)
    setMessage('Joined plan successfully.')
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

  const switchUser = () => {
    if (!userIdInput.trim()) return
    setUserId(userIdInput.trim())
    setMessage(`Switched local identity to ${userIdInput.trim()}.`)
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
      <p><strong>Step 1:</strong> set your user identity (example: <code>alex</code>, <code>brian</code>) so each person has their own profile.</p>
      <div className="row">
        <input value={userIdInput} onChange={e => setUserIdInput(e.target.value)} />
        <button onClick={switchUser}>Switch User</button>
      </div>
      <p>Current user id: <code>{getUserId()}</code></p>

      <p><strong>Step 2:</strong> create a plan and share it.</p>
      <div className="row">
        <input value={name} onChange={e => setName(e.target.value)} />
        <button onClick={create}>Create New Plan</button>
      </div>

      <p><strong>Step 3:</strong> second person opens link or joins with Plan ID.</p>
      <div className="row">
        <input placeholder="Paste plan id" value={joinId} onChange={e => setJoinId(e.target.value)} />
        <button onClick={() => join()}>Join Plan</button>
        <button onClick={loadCurrent}>Load My Current Plan</button>
      </div>

      {message && <p>{message}</p>}

      {plan && (
        <div>
          <h3>{plan.plan.name}</h3>
          <p>Plan ID: <code>{plan.plan.id}</code></p>
          <p>Share link: <code>{shareLink}</code></p>
          <h4>Participants</h4>
          <ul>
            {plan.participants.map(p => <li key={p.user_id}>{p.user_id} ({p.connected_accounts} connected calendar provider(s))</li>)}
          </ul>
        </div>
      )}

      {readiness && (
        <div>
          <h4>Readiness</h4>
          <p>{readiness.all_ready ? '✅ All participants connected at least one calendar.' : '⚠️ Some participants still need to connect a calendar.'}</p>
          <ul>
            {readiness.participants.map(p => <li key={p.user_id}>{p.user_id}: {p.ready ? 'ready' : 'not ready'}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
