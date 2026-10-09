import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { authViewParam, type AuthView } from './auth'
import { isAuthView } from './auth.schema'

const oidcErrorParam = 'oidc_error'

export function useAuthDialog(signedIn: boolean) {
  const [params] = useSearchParams()
  const stay = useInPageNavigate()
  const [requested, setRequested] = useState<AuthView>()
  const [shown, setShown] = useState<AuthView>('sign-in')
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
  const wanted = requested ?? urlView
  if (wanted !== undefined && wanted !== shown) {
    setShown(wanted)
  }
  const view = wanted ?? shown
  const open = !signedIn && wanted !== undefined
  const linked = urlView !== undefined

  useEffect(() => {
    if (!signedIn) {
      return
    }
    const next = resume.current
    resume.current = undefined
    next?.()
  }, [signedIn])

  const unlink = () => stay(`?${withoutDialog(params)}`, { replace: true })
  const unlinkSignedIn = useEffectEvent(unlink)

  useEffect(() => {
    if (signedIn && linked) {
      unlinkSignedIn()
    }
  }, [signedIn, linked])

  const show = (next: AuthView, then?: () => void) => {
    resume.current = then
    setRequested(next)
  }

  const close = () => {
    resume.current = undefined
    setRequested(undefined)
    if (linked) {
      unlink()
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
