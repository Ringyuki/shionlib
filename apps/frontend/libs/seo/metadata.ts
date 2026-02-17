import type { Metadata } from 'next'
import { supportedLocales, SupportedLocales } from '@/config/i18n/supported'
import { shionlibSiteConfig } from '@/config/site/shionlib'

export interface PageSeoInput {
  path: string
  title: string
  description?: string
  og?: OgImageObject
  robots?: Metadata['robots']
  xDefaultPath?: string
}
export interface OgImageObject {
  title?: string
  description?: string
  image?: string
  aspect?: '2:3' | '3:2' | '1:1'
}

export async function buildPageMetadata(
  locale: SupportedLocales | string,
  input: PageSeoInput,
): Promise<Metadata> {
  const localePath = `/${locale}${input.path}`
  const languages = Object.fromEntries(
    supportedLocales.map(l => [l, `/${l}${input.path}`]),
  ) as Record<SupportedLocales, string>

  const alternates: NonNullable<Metadata['alternates']> = {
    canonical: localePath,
    languages: { ...languages, 'x-default': input.xDefaultPath || input.path },
  }

  const ogUrl = new URL(
    `/og?l=${encodeURIComponent(String(locale))}&t=${encodeURIComponent(input.og?.title || input.title)}&d=${encodeURIComponent(input.og?.description || input.description || '')}&i=${encodeURIComponent(input.og?.image || '')}&ar=${encodeURIComponent(input.og?.aspect || '3:2')}`,
    new URL(shionlibSiteConfig.canonical).origin,
  ).toString()

  return {
    title: input.title,
    description: input.description,
    icons: {
      icon: '/favicon.ico',
      apple: '/favicon.ico',
    },
    alternates,
    openGraph: {
      title: input.title,
      description: input.description,
      url: localePath,
      images: ogUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: ogUrl,
    },
    robots: input.robots,
  }
}

export function createGenerateMetadata<Args extends Record<string, any>>(
  resolve: (args: Args) => Promise<PageSeoInput> | PageSeoInput,
) {
  return async function generateMetadata({
    params,
    searchParams,
  }: {
    params: any | Promise<any>
    searchParams?: any | Promise<any>
  }): Promise<Metadata> {
    const awaitedParams =
      params && typeof (params as any).then === 'function' ? await (params as any) : (params as any)
    const awaitedSearch =
      searchParams && typeof (searchParams as any).then === 'function'
        ? await (searchParams as any)
        : (searchParams as any)
    const locale: string = awaitedParams?.locale
    const args = { ...(awaitedParams || {}), ...(awaitedSearch || {}) } as Args
    const input = await resolve(args)
    return buildPageMetadata(locale, input)
  }
}
