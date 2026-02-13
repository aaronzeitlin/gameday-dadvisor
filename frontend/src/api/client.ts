const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const USER_EMAIL_KEY = 'gameday_user_email'
const USER_ID_KEY = 'gameday_user_id'
const PLAN_ID_KEY = 'gameday_plan_id'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export function getUserEmail(): string {
  return localStorage.getItem(USER_EMAIL_KEY) || ''
}

export function setUserEmail(email: string): void {
  const normalized = normalizeEmail(email)
  if (!normalized) return
  localStorage.setItem(USER_EMAIL_KEY, normalized)
  localStorage.setItem(USER_ID_KEY, normalized)
}

export function getUserId(): string {
  const email = getUserEmail()
  if (email) return email

  const existing = localStorage.getItem(USER_ID_KEY)
  if (existing) return existing

  const created = `user-${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem(USER_ID_KEY, created)
  return created
}

export function setUserId(userId: string): void {
  const trimmed = userId.trim()
  if (!trimmed) return
  localStorage.setItem(USER_ID_KEY, trimmed)
}

export function getPlanId(): string | null {
  return localStorage.getItem(PLAN_ID_KEY)
}

export function setPlanId(planId: string): void {
  localStorage.setItem(PLAN_ID_KEY, planId)
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
