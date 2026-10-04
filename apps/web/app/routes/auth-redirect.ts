import { redirect } from 'react-router'
import { authViewParam, type AuthView } from '~/features/auth'
import type { Route } from './+types/auth-redirect'

export function loader({ params, request }: Route.LoaderArgs) {
  const view: AuthView = new URL(request.url).pathname.endsWith('/register') ? 'sign-up' : 'sign-in'
  return redirect(`/${params.lang}?${authViewParam}=${view}`)
}
