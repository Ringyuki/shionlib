import { getTranslations } from 'next-intl/server'
import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'

export const Head = async () => {
  const t = await getTranslations('Components.Home.RecentUpdate.Head')
  return (
    <PageHeader showSeparator={false}>
      <PageHeaderTitle title={t('title')} className="text-xl" />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
