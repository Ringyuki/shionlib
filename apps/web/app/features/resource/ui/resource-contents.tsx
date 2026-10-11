import { Empty } from '@hina-ui/react'
import { Clock } from 'lucide-react'
import { useTranslations } from 'use-intl'

export function ResourceContents() {
  const t = useTranslations('resource.page.contents')
  return <Empty icon={<Clock />} title={t('pending')} description={t('pendingHint')} />
}
