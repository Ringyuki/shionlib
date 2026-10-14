import { redirect } from 'react-router'
import { localizedLocation, localizedRedirectStatus } from '~/shared/i18n/locale.schema'
import type { Route } from './+types/locale-redirect'

export function loader({ request, url }: Route.LoaderArgs) {
  const cookie = request.headers.get('cookie') ?? ''
  return redirect(localizedLocation(cookie, url), localizedRedirectStatus(cookie, url))
}
