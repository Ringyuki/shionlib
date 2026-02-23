'use client'

const DEVICE_HAS_PASSKEY_HINT_KEY = 'shionlib:passkey:device-has-passkey'

export const hasDevicePasskeyHint = () => {
  try {
    return localStorage.getItem(DEVICE_HAS_PASSKEY_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export const markDeviceHasPasskeyHint = () => {
  try {
    localStorage.setItem(DEVICE_HAS_PASSKEY_HINT_KEY, '1')
  } catch {}
}
