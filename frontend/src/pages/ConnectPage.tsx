import { useEffect, useState } from 'react'
import { api, getPlanId, getUserEmail, getUserId, setUserEmail } from '../api/client'

type Account = { provider: string; account_email: string; created_at: string }

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [email, setEmail] = useState(getUserEmail() || 'alice@example.com')

  const load = () => api<{ connected_accounts: Account[] }>('/me').then(r => setAccounts(r.connected_accounts))
  useEffect(() => { load() }, [])

  const connect = async (provider: 'google' | 'microsoft') => {
    setUserEmail(email)
    await api(`/auth/${provider}/callback?account_email=${encodeURIComponent(email.trim().toLowerCase())}`, 'POST')
    load()
  }

  const disconnect = async (provider: string) => {
    await api(`/disconnect/${provider}`, 'POST')
    load()
  }

  return (
    <section>
      <p>Use Google or Microsoft sign-in to connect your calendar. We use your email as your shared-plan identity.</p>
      <p className="meta">User: <code className="inline-code">{getUserId()}</code> | Plan: <code className="inline-code">{getPlanId() || 'none'}</code></p>
      <label>Email account
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <div className="row">
        <button onClick={() => connect('google')}>SSO + Connect Google</button>
        <button className="secondary" onClick={() => connect('microsoft')}>SSO + Connect Microsoft</button>
      </div>
      <h3>Connected accounts</h3>
      <ul className="list">
        {accounts.map(a => (
          <li key={a.provider + a.account_email}>
            {a.provider}: {a.account_email}
            <button className="secondary" onClick={() => disconnect(a.provider)}>Disconnect</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
