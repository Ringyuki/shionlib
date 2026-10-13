import { redirect } from 'react-router'
import { localizedLocation } from '~/shared/i18n/locale.schema'
import type { Route } from './+types/locale-redirect'

export function loader({ request, url }: Route.LoaderArgs) {
  return redirect(localizedLocation(request.headers.get('cookie') ?? '', url))
}
