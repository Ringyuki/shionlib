'use client'

import { NextIntlClientProvider } from 'next-intl'
import enPages from '@/messages/en/Pages.json'
import zhPages from '@/messages/zh/Pages.json'
import jaPages from '@/messages/ja/Pages.json'
import { usePathname } from 'next/navigation'
import { supportedLocales, SupportedLocales } from '@/config/i18n/supported'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { useRouter } from 'next/navigation'
import { parsePublicErrorDigest } from '@/libs/errors'
import '@/public/assets/styles/globals.css'

const MESSAGES: Record<SupportedLocales, Record<string, string>> = {
  en: enPages.GlobalError,
  zh: zhPages.GlobalError,
  ja: jaPages.GlobalError,
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const publicError = parsePublicErrorDigest(error?.digest)
  const pathname = usePathname() || '/'
  const maybeLocale = pathname.split('/')[1]
  const locale = maybeLocale && supportedLocales.includes(maybeLocale) ? maybeLocale : 'en'
  return (
    <html lang={locale as SupportedLocales} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale as SupportedLocales]}>
          <div className="min-h-screen flex items-center justify-center bg-radial px-4">
            <Card className="w-fit max-w-sm gap-2">
              <CardHeader>
                <CardTitle className="text-xl font-mono! break-all">
                  {MESSAGES[locale as SupportedLocales].title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground font-mono!">
                  {publicError?.message || error.message}
                </p>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button className="w-full" onClick={() => router.back()}>
                  {MESSAGES[locale as SupportedLocales].back}
                </Button>
                <Button className="w-full" onClick={reset}>
                  {MESSAGES[locale as SupportedLocales].reset}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
