import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from '@/components/common/content/PageHeader'
import { getTranslations, getLocale } from 'next-intl/server'
import { getLastFridays } from '@/app/[locale]/_helpers/getFriday'

export const Head = async () => {
  const t = await getTranslations('Components.Home.NewWorks.Head')
  const locale = (await getLocale()) as 'zh' | 'ja' | 'en'
  const { monthName, yearName } = getLastFridays(new Date(), locale)
  return (
    <PageHeader showSeparator={false}>
      <PageHeaderTitle title={t('title')} className="text-xl" />
      <PageHeaderDescription description={t('release', { monthName, yearName })} />
      <PageHeaderDescription description={t('description')} />
    </PageHeader>
  )
}
