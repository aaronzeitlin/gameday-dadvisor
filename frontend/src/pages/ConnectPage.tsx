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
      <p>User: <code>{getUserId()}</code> | Plan: <code>{getPlanId() || 'none'}</code></p>
      <label>Calendar email for this user (MVP mock free/busy fixture)
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <div className="row">
        <button onClick={() => connect('google')}>Connect Google</button>
        <button onClick={() => connect('microsoft')}>Connect Microsoft</button>
      </div>
      <h3>Connected accounts</h3>
      <ul>
        {accounts.map(a => (
          <li key={a.provider + a.account_email}>
            {a.provider}: {a.account_email}
            <button onClick={() => disconnect(a.provider)}>Disconnect</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
