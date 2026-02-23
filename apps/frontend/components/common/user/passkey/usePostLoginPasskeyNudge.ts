'use client'

import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { shionlibRequest } from '@/utils/request'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { PasskeyCredentialItem } from '@/interfaces/auth/passkey.interface'
import { useIsAutomatingBrowser } from '@/hooks/useIsAutomatingBrowser'

const getSessionDismissKey = (userId: number) => `shionlib:passkey-bind-nudge:dismissed:${userId}`

export const usePostLoginPasskeyNudge = () => {
  const { openPasskeyBindNudgeDialog } = useAuthDialogStore()
  const isAutomationBrowser = useIsAutomatingBrowser()

  const dismissForSession = (userId: number) => {
    if (userId <= 0) return
    try {
      sessionStorage.setItem(getSessionDismissKey(userId), '1')
    } catch {}
  }

  const isDismissedForSession = (userId: number) => {
    if (userId <= 0) return false
    try {
      return sessionStorage.getItem(getSessionDismissKey(userId)) === '1'
    } catch {
      return false
    }
  }

  const maybeOpen = async (userId?: number) => {
    try {
      if (!userId || userId <= 0) return
      if (isDismissedForSession(userId)) return
      if (isAutomationBrowser()) return
      if (!browserSupportsWebAuthn()) return

      const res = await shionlibRequest({ forceNotThrowError: true }).get<PasskeyCredentialItem[]>(
        '/auth/passkey',
      )
      if (res.code !== 0) return

      if ((res.data?.length ?? 0) > 0) return
      openPasskeyBindNudgeDialog()
    } catch {
      // best-effort prompt only
    }
  }

  return { maybeOpen, dismissForSession, isDismissedForSession }
}
