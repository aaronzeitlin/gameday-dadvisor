const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getUserId(): string {
  const existing = localStorage.getItem('gameday_user_id')
  if (existing) return existing
  const created = `user-${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem('gameday_user_id', created)
  return created
}

export function setUserId(userId: string): void {
  localStorage.setItem('gameday_user_id', userId.trim())
}

export function getPlanId(): string | null {
  return localStorage.getItem('gameday_plan_id')
}

export function setPlanId(planId: string): void {
  localStorage.setItem('gameday_plan_id', planId)
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId()
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
