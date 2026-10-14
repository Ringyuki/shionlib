import { createTranslator } from 'use-intl/core'
import { type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { organization, website } from '~/shared/seo/structured-data'

export function homeHead({ locale, messages }: HeadTexts): PageHead {
  const t = createTranslator({ locale, messages, namespace: 'home.seo' })
  return {
    title: t('title'),
    whole: true,
    description: t('description'),
    structured: at => [
      website(at, `/${locale}`, t('alternateName')),
      organization(at, `/${locale}`),
    ],
  }
}
