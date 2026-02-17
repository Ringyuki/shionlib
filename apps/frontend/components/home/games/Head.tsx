import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { getTranslations } from 'next-intl/server'

export const Head = async () => {
  const t = await getTranslations('Components.Home.Games.Head')
  return (
    <PageHeader showSeparator={false}>
      <PageHeaderTitle title={t('title')} className="text-xl" />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
