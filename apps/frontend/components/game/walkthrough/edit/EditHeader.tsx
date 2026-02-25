'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export const WalkthroughEditHeader = () => {
  const t = useTranslations('Components.Game.Walkthrough.EditLayout')
  const searchParams = useSearchParams()
  const isCreate = !searchParams.get('walkthrough_id')

  return <h2 className="text-2xl font-bold">{isCreate ? t('create') : t('edit')}</h2>
}
