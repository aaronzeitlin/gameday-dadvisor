import { useEffect, useState } from 'react'
import { api, getPlanId, getUserEmail, getUserId, setUserEmail } from '../api/client'

type Account = { provider: string; account_email: string; created_at: string }

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [email, setEmail] = useState(getUserEmail() || 'alice@example.com')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const load = () => api<{ connected_accounts: Account[] }>('/me').then(r => setAccounts(r.connected_accounts))
  useEffect(() => { load() }, [])

  const connect = async (provider: 'google' | 'microsoft') => {
    setIsConnecting(true)
    setErrorMessage('')
    try {
      setUserEmail(email)
      await api(`/auth/${provider}/callback?account_email=${encodeURIComponent(email.trim().toLowerCase())}`, 'POST')
      await load()
    } catch {
      setErrorMessage('Could not connect your account right now. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async (provider: string) => {
    setIsDisconnecting(true)
    setErrorMessage('')
    try {
      await api(`/disconnect/${provider}`, 'POST')
      await load()
    } catch {
      setErrorMessage('Could not disconnect the account right now. Please try again.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const isBusy = isConnecting || isDisconnecting

  return (
    <section>
      <p>Use Google or Microsoft sign-in to connect your calendar. We use your email as your shared-plan identity.</p>
      <p className="meta">User: <code className="inline-code">{getUserId()}</code> | Plan: <code className="inline-code">{getPlanId() || 'none'}</code></p>
      <label>Email account
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isBusy} />
      </label>
      <div className="row">
        <button onClick={() => connect('google')} disabled={isBusy}>SSO + Connect Google</button>
        <button className="secondary" onClick={() => connect('microsoft')} disabled={isBusy}>SSO + Connect Microsoft</button>
      </div>
      {errorMessage && <p className="status error">{errorMessage}</p>}
      <h3>Connected accounts</h3>
      <ul className="list">
        {accounts.map(a => (
          <li key={a.provider + a.account_email}>
            {a.provider}: {a.account_email}
            <button className="secondary" onClick={() => disconnect(a.provider)} disabled={isBusy}>Disconnect</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
