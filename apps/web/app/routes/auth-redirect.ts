import { redirect } from 'react-router'
import { authViewParam, type AuthView } from '~/features/auth'
import type { Route } from './+types/auth-redirect'

export function loader({ params, url }: Route.LoaderArgs) {
  const view: AuthView = url.pathname.endsWith('/register') ? 'sign-up' : 'sign-in'
  return redirect(`/${params.lang}?${authViewParam}=${view}`)
}
