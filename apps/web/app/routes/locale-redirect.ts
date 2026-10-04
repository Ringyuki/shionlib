import { redirect } from 'react-router'
import { negotiateLocale } from '~/shared/i18n/locale'
import type { Route } from './+types/locale-redirect'

export function loader({ request }: Route.LoaderArgs) {
  const locale = negotiateLocale(
    request.headers.get('cookie') ?? '',
    request.headers.get('accept-language') ?? '',
  )
  const url = new URL(request.url)
  const path = url.pathname === '/' ? '' : url.pathname
  return redirect(`/${locale}${path}${url.search}`)
}
