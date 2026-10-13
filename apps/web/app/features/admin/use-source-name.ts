import { useTranslations } from 'use-intl'

const named = ['hikarinagi'] as const

export function useSourceName(): (source: string) => string {
  const t = useTranslations('admin.source')
  return source => {
    const known = named.find(name => name === source)
    return known === undefined ? source : t(known)
  }
}
