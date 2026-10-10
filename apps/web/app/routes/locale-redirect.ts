import { redirect } from 'react-router'
import { negotiateLocale } from '~/shared/i18n/locale.schema'
import type { Route } from './+types/locale-redirect'

export function loader({ request, url }: Route.LoaderArgs) {
  const locale = negotiateLocale(
    request.headers.get('cookie') ?? '',
    request.headers.get('accept-language') ?? '',
  )
  const path = url.pathname === '/' ? '' : url.pathname
  return redirect(`/${locale}${path}${url.search}`)
}
