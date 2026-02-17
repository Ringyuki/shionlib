import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { getTranslations } from 'next-intl/server'

export const Header = async () => {
  const t = await getTranslations('Components.Game.Filter.Header')
  return (
    <PageHeader>
      <PageHeaderTitle title={t('title')} />
      <PageHeaderDescription description={t('description')} />
      <PageHeaderDescription description={t('subDescription')} />
    </PageHeader>
  )
}
