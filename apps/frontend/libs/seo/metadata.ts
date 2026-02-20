import type { Metadata } from 'next'
import { supportedLocales, SupportedLocales } from '@/config/i18n/supported'

export type OgImageInput = {
  resourceType: 'game' | 'character' | 'developer'
  id: string
}

export interface PageSeoInput {
  path: string
  title: string
  description?: string
  og?: OgImageInput
  robots?: Metadata['robots']
  xDefaultPath?: string
}

function buildOgUrl(og: OgImageInput | undefined, locale: string): string {
  const base = process.env.NEXT_PUBLIC_OG_SERVICE_URL?.replace(/\/$/, '')
  if (!og) return `${base}/default?${new URLSearchParams({ locale })}`
  return `${base}/${og.resourceType}/${og.id}?${new URLSearchParams({ locale })}`
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

  const ogUrl = buildOgUrl(input.og, locale)

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
