'use client'

import ErrorView from '@/components/common/error/ErrorView'
import { useTranslations } from 'next-intl'

export default function NotFound() {
  const t = useTranslations('Pages.NotFound')
  return (
    <div className="w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ErrorView title={t('title')} details={t('details')} />
      </div>
    </div>
  )
}
