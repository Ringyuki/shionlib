import { UiLocaleProvider, enUS, jaJP, zhCN } from '@hina-ui/react'
import type { ReactNode } from 'react'
import {
  Outlet,
  redirect,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { IntlProvider } from 'use-intl'
import { loadMessages } from '~/messages'
import type { Locale } from '~/shared/i18n/locale'
import { isLocale, localizedLocation } from '~/shared/i18n/locale.schema'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { KeptData } from '~/shared/route/kept-data'
import { ErrorPage } from '~/shared/ui/error-page'
import type { Route } from './+types/lang'

const uiMessages = { zh: zhCN, en: enUS, ja: jaJP } satisfies Record<Locale, typeof zhCN>

export async function loader({ params, request, url }: Route.LoaderArgs) {
  if (!isLocale(params.lang)) {
    throw redirect(localizedLocation(request.headers.get('cookie') ?? '', url))
  }
  return { locale: params.lang, messages: await loadMessages(params.lang) }
}

export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.lang !== nextParams.lang
}

export default function LangLayout({ loaderData }: Route.ComponentProps) {
  return (
    <LocaleProviders locale={loaderData.locale} messages={loaderData.messages}>
      <KeptData />
      <Outlet />
    </LocaleProviders>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const loaded = useRouteLoaderData<typeof loader>('routes/lang')
  if (loaded === undefined) {
    throw error
  }
  return (
    <LocaleProviders locale={loaded.locale} messages={loaded.messages}>
      <ErrorPage error={error} />
    </LocaleProviders>
  )
}

function LocaleProviders({
  locale,
  messages,
  children,
}: Route.ComponentProps['loaderData'] & { children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={messages} timeZone={siteTimeZone}>
      <UiLocaleProvider messages={uiMessages[locale]}>{children}</UiLocaleProvider>
    </IntlProvider>
  )
}
