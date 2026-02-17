import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supportedLocales, SupportedLocales } from '@/config/i18n/supported'
import { shionlibSiteConfig } from '@/config/site/shionlib'

export const langMap: Record<SupportedLocales, string> = {
  en: 'en',
  zh: 'zh_Hans',
  ja: 'ja',
} as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Meta' })

  const metadataBase = new URL(shionlibSiteConfig.canonical)

  const languages = Object.fromEntries(supportedLocales.map(l => [l, `/${l}`])) as Record<
    SupportedLocales,
    string
  >

  return {
    metadataBase,
    title: {
      default: t('title'),
      template: t('template'),
    },
    description: t('description'),
    icons: {
      icon: '/favicon.ico',
      apple: '/favicon.ico',
    },
    keywords: t.raw('keywords'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...languages,
        'x-default': '/',
      },
    },
    openGraph: {
      title: t('og.title'),
      description: t('og.description'),
      url: `/${locale}`,
      images: [{ url: `/og?l=${locale}` }],
      locale: langMap[locale as SupportedLocales],
      alternateLocale: supportedLocales
        .filter(l => l !== locale)
        .map(l => langMap[l as SupportedLocales]),
      siteName: t('titleShort'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('og.title'),
      description: t('og.description'),
      images: [`/og?l=${locale}`],
    },
    robots: {
      index: shionlibSiteConfig.robots.index,
      follow: shionlibSiteConfig.robots.follow,
    },
  }
}
