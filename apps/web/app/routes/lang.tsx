import { UiLocaleProvider, enUS, zhCN } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { data, Outlet, useRouteLoaderData, type ShouldRevalidateFunctionArgs } from 'react-router'
import { IntlProvider } from 'use-intl'
import { loadMessages } from '~/messages'
import { isLocale, type Locale } from '~/shared/i18n/locale'
import { ErrorPage } from '~/shared/ui/error-page'
import type { Route } from './+types/lang'

const uiMessages = { zh: zhCN, en: enUS, ja: enUS } satisfies Record<Locale, typeof zhCN>

export async function loader({ params }: Route.LoaderArgs) {
  if (!isLocale(params.lang)) {
    throw data(null, { status: 404 })
  }
  return { locale: params.lang, messages: await loadMessages(params.lang) }
}

export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.lang !== nextParams.lang
}

export default function LangLayout({ loaderData }: Route.ComponentProps) {
  return (
    <LocaleProviders locale={loaderData.locale} messages={loaderData.messages}>
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
    <IntlProvider locale={locale} messages={messages} timeZone="Asia/Shanghai">
      <UiLocaleProvider messages={uiMessages[locale]}>{children}</UiLocaleProvider>
    </IntlProvider>
  )
}
