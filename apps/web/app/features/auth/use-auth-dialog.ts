import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { authViewParam, isAuthView, type AuthView } from './auth'

const oidcErrorParam = 'oidc_error'

export function useAuthDialog(signedIn: boolean) {
  const [params, setParams] = useSearchParams()
  const [requested, setRequested] = useState<AuthView>()
  const [seenSignedIn, setSeenSignedIn] = useState(signedIn)
  const resume = useRef<(() => void) | undefined>(undefined)

  if (seenSignedIn !== signedIn) {
    setSeenSignedIn(signedIn)
    if (signedIn) {
      setRequested(undefined)
    }
  }

  const fromUrl = params.get(authViewParam)
  const oidcFailed = params.has(oidcErrorParam)
  const urlView = isAuthView(fromUrl) ? fromUrl : oidcFailed ? 'sign-in' : undefined
  const view = requested ?? urlView ?? 'sign-in'
  const open = !signedIn && (requested !== undefined || urlView !== undefined)
  const linked = urlView !== undefined

  useEffect(() => {
    if (!signedIn) {
      return
    }
    const next = resume.current
    resume.current = undefined
    next?.()
  }, [signedIn])

  useEffect(() => {
    if (signedIn && linked) {
      setParams(withoutDialog, { replace: true, preventScrollReset: true })
    }
  }, [signedIn, linked, setParams])

  const show = (next: AuthView, then?: () => void) => {
    resume.current = then
    setRequested(next)
  }

  const close = () => {
    resume.current = undefined
    setRequested(undefined)
    if (linked) {
      setParams(withoutDialog, { replace: true, preventScrollReset: true })
    }
  }

  return { open, view, show, close, switchTo: setRequested, oidcFailed }
}

function withoutDialog(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current)
  next.delete(authViewParam)
  next.delete(oidcErrorParam)
  return next
}
