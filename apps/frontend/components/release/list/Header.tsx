import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export const ReleaseListHeader = async () => {
  const t = await getTranslations('Components.Release.List.Header')
  return (
    <PageHeader>
      <PageHeaderTitle title={t('title')} />
      <PageHeaderDescription description={t('description')} />
      <PageHeaderDescription
        description={
          <span>
            {t('subDescriptionPrefix')}{' '}
            <Link
              href="/docs/guides/upload-game-files"
              className="text-primary-500 hover:text-primary-600 transition-colors"
            >
              {t('subDescriptionLink')}
            </Link>{' '}
            {t('subDescriptionSuffix')}
          </span>
        }
      />
    </PageHeader>
  )
}
