import type { ReactNode } from 'react'
import { IntlProvider, useLocale, useMessages, type AbstractIntlMessages } from 'use-intl'
import { siteTimeZone } from './site-time'

type ExtraMessagesProps = {
  messages: AbstractIntlMessages | undefined
  children: ReactNode
}

export function ExtraMessages({ messages, children }: ExtraMessagesProps) {
  const locale = useLocale()
  const base = useMessages()
  if (messages === undefined) {
    return children
  }
  return (
    <IntlProvider locale={locale} messages={{ ...base, ...messages }} timeZone={siteTimeZone}>
      {children}
    </IntlProvider>
  )
}
