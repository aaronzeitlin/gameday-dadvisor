export type UiToast = { id: string; message: string; tone: string }
export type UiSnapshot = {
  signedInEmail: string
  userId: string
  currentPlanId: string
  toasts: UiToast[]
}

export const uiState: {
  subscribe: (listener: () => void) => () => void
  snapshot: () => UiSnapshot
  setSignedInEmail: (email: string) => void
  setPlanId: (planId: string) => void
  parseJoinPlanFromUrl: () => string | null
  copyText: (text: string) => Promise<void>
  readinessChecklist: (participants: { connected_accounts: number }[]) => { total: number; connected: number; allConnected: boolean; missing: { connected_accounts: number }[] }
  addToast: (message: string, tone?: string) => void
  clearToasts: () => void
}
