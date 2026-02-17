'use client'

import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en.json'
import zh from '@/messages/zh.json'
import ja from '@/messages/ja.json'
import { usePathname } from 'next/navigation'
import { supportedLocales, SupportedLocales } from '@/config/i18n/supported'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { useRouter } from 'next/navigation'
import '@/public/assets/styles/globals.css'

const MESSAGES: Record<SupportedLocales, Record<string, string>> = {
  en: en.Pages.GlobalNotFound,
  zh: zh.Pages.GlobalNotFound,
  ja: ja.Pages.GlobalNotFound,
}

export default function GlobalNotFound() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const maybeLocale = pathname.split('/')[1]
  const locale = maybeLocale && supportedLocales.includes(maybeLocale) ? maybeLocale : 'en'
  return (
    <html>
      <body>
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale as SupportedLocales]}>
          <div className="w-[100dvw] h-[100dvh] flex items-center justify-center">
            <Card className="w-fit max-w-sm gap-2">
              <CardHeader>
                <CardTitle className="text-xl font-mono! break-all">
                  {MESSAGES[locale as SupportedLocales].title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 whitespace-pre-wrap break-words text-sm text-muted-foreground font-mono!">
                  {MESSAGES[locale as SupportedLocales].details}
                </p>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button className="w-full" onClick={() => router.back()}>
                  {MESSAGES[locale as SupportedLocales].back}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
