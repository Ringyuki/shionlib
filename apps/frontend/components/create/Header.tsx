'use client'

import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'

export const Header = () => {
  const t = useTranslations('Components.Create.Header')
  return (
    <PageHeader>
      <PageHeaderTitle title={t('title')} />
      <PageHeaderDescription
        description={
          <span>
            {t('descriptionPrefix')}
            <Link
              href="https://vndb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
            >
              {t('vndb')}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            {t('descriptionMiddle')}
            <Link
              href="https://bgm.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
            >
              {t('bangumi')}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            {t('descriptionSuffix')}
          </span>
        }
      />
      <PageHeaderDescription
        description={
          <span>
            {t('guidePrefix')}
            <Link
              href="https://www.kungal.com/topic/1040"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
            >
              {t('guideLink')}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            {t('guideSuffix')}
          </span>
        }
      />
    </PageHeader>
  )
}
