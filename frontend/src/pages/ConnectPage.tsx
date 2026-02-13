import { useEffect, useState } from 'react'
import { api, getUserId, getPlanId } from '../api/client'

type Account = { provider: string; account_email: string; created_at: string }

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [email, setEmail] = useState('alice@example.com')

  const load = () => api<{ connected_accounts: Account[] }>('/me').then(r => setAccounts(r.connected_accounts))
  useEffect(() => { load() }, [])

  const connect = async (provider: 'google' | 'microsoft') => {
    await api(`/auth/${provider}/callback?account_email=${encodeURIComponent(email)}`, 'POST')
    load()
  }

  const disconnect = async (provider: string) => {
    await api(`/disconnect/${provider}`, 'POST')
    load()
  }

  return (
    <section>
      <p>Connect Google and/or Microsoft for free/busy availability checks.</p>
      <p className="meta">User: <code className="inline-code">{getUserId()}</code> | Plan: <code className="inline-code">{getPlanId() || 'none'}</code></p>
      <label>Calendar email for this user (MVP mock free/busy fixture)
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <div className="row">
        <button onClick={() => connect('google')}>Connect Google</button>
        <button className="secondary" onClick={() => connect('microsoft')}>Connect Microsoft</button>
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
