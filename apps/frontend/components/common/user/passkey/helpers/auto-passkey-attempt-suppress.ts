'use client'

const AUTO_PASSKEY_LOGIN_SUPPRESS_KEY = 'shionlib:passkey-login:auto-attempt-suppressed'

export const isAutoPasskeyAttemptSuppressedForSession = () => {
  try {
    return sessionStorage.getItem(AUTO_PASSKEY_LOGIN_SUPPRESS_KEY) === '1'
  } catch {
    return false
  }
}

export const suppressAutoPasskeyAttemptForSession = () => {
  try {
    sessionStorage.setItem(AUTO_PASSKEY_LOGIN_SUPPRESS_KEY, '1')
  } catch {}
}
