'use client'

import { useEffect, useRef } from 'react'
import { useShionlibUserStore } from '@/store/userStore'
import { usePostLoginPasskeyNudge } from '@/components/common/user/passkey/usePostLoginPasskeyNudge'
import { useAuthDialogStore } from '@/store/authDialogStore'

export const PasskeyBindNudgeWatcher = () => {
  const userId = useShionlibUserStore(state => state.user.id)
  const loginSuccessNonce = useAuthDialogStore(state => state.loginSuccessNonce)
  const lastHandledNonceRef = useRef(0)
  const { maybeOpen } = usePostLoginPasskeyNudge()

  useEffect(() => {
    if (!loginSuccessNonce || loginSuccessNonce === lastHandledNonceRef.current) return
    if (userId <= 0) return
    lastHandledNonceRef.current = loginSuccessNonce
    void maybeOpen(userId)
  }, [loginSuccessNonce, maybeOpen, userId])

  return null
}
