const STORAGE_KEYS = {
  email: 'gameday_user_email',
  userId: 'gameday_user_id',
  planId: 'gameday_plan_id'
}

const toasts = []
const listeners = new Set()

const normalizeEmail = (email = '') => email.trim().toLowerCase()

const emit = () => {
  listeners.forEach(listener => listener())
}

const getStored = () => ({
  signedInEmail: localStorage.getItem(STORAGE_KEYS.email) || '',
  userId: localStorage.getItem(STORAGE_KEYS.userId) || '',
  currentPlanId: localStorage.getItem(STORAGE_KEYS.planId) || '',
  toasts: [...toasts]
})

export const uiState = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  snapshot() {
    return getStored()
  },
  setSignedInEmail(email) {
    const normalized = normalizeEmail(email)
    if (!normalized) return
    localStorage.setItem(STORAGE_KEYS.email, normalized)
    localStorage.setItem(STORAGE_KEYS.userId, normalized)
    emit()
  },
  setPlanId(planId) {
    if (!planId) return
    localStorage.setItem(STORAGE_KEYS.planId, planId)
    emit()
  },
  parseJoinPlanFromUrl() {
    const params = new URLSearchParams(window.location.search)
    return params.get('joinPlan')
  },
  copyText(text) {
    return navigator.clipboard.writeText(text)
  },
  readinessChecklist(participants = []) {
    const connected = participants.filter(p => p.connected_accounts > 0).length
    const total = participants.length
    return {
      total,
      connected,
      allConnected: total > 0 && connected === total,
      missing: participants.filter(p => p.connected_accounts < 1)
    }
  },
  addToast(message, tone = 'success') {
    const toast = { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, message, tone }
    toasts.push(toast)
    emit()
    window.setTimeout(() => {
      const idx = toasts.findIndex(item => item.id === toast.id)
      if (idx >= 0) {
        toasts.splice(idx, 1)
        emit()
      }
    }, 2400)
  },
  clearToasts() {
    toasts.splice(0, toasts.length)
    emit()
  }
}
