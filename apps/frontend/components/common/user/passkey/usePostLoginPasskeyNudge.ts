'use client'

import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { shionlibRequest } from '@/utils/request'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { PasskeyCredentialItem } from '@/interfaces/auth/passkey.interface'
import {
  dismissPasskeyBindNudgeForSession,
  isPasskeyBindNudgeDismissedForSession,
} from '@/components/common/user/passkey/helpers/passkey-bind-nudge-session'
import { useIsAutomatingBrowser } from '@/hooks/useIsAutomatingBrowser'

export const usePostLoginPasskeyNudge = () => {
  const { openPasskeyBindNudgeDialog } = useAuthDialogStore()
  const isAutomationBrowser = useIsAutomatingBrowser()

  const dismissForSession = (userId: number) => {
    dismissPasskeyBindNudgeForSession(userId)
  }

  const isDismissedForSession = (userId: number) => {
    return isPasskeyBindNudgeDismissedForSession(userId)
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
