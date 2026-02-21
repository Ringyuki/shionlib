import { getTranslations } from 'next-intl/server'
import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'

export const Head = async () => {
  const t = await getTranslations('Components.Home.Activity.Head')
  return (
    <PageHeader showSeparator={false}>
      <PageHeaderTitle title={t('title')} />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
