'use client'

const getSessionDismissKey = (userId: number) => `shionlib:passkey-bind-nudge:dismissed:${userId}`

export const dismissPasskeyBindNudgeForSession = (userId: number) => {
  if (userId <= 0) return
  try {
    sessionStorage.setItem(getSessionDismissKey(userId), '1')
  } catch {}
}

export const isPasskeyBindNudgeDismissedForSession = (userId: number) => {
  if (userId <= 0) return false
  try {
    return sessionStorage.getItem(getSessionDismissKey(userId)) === '1'
  } catch {
    return false
  }
}
