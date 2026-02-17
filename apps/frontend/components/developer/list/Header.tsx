import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { getTranslations } from 'next-intl/server'

export const Header = async () => {
  const t = await getTranslations('Components.Developer.List.Header')
  return (
    <PageHeader>
      <PageHeaderTitle title={t('title')} />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
