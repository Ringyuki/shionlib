import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { useTranslations } from 'next-intl'

export const Head = () => {
  const t = useTranslations('Components.Home.Games.Head')
  return (
    <PageHeader showSeparator={false}>
      <PageHeaderTitle title={t('title')} className="text-xl" />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
