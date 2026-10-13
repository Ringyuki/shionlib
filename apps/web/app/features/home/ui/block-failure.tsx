import { Empty } from '@hina-ui/react'
import { CloudOff } from 'lucide-react'
import { useRevalidator } from 'react-router'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

export function BlockFailure() {
  const t = useTranslations('home')
  const revalidator = useRevalidator()
  return (
    <Empty
      icon={<CloudOff />}
      title={t('failed')}
      size="sm"
      actions={
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          loading={revalidator.state === 'loading'}
          onClick={() => void revalidator.revalidate()}
        >
          {t('retry')}
        </Button>
      }
    />
  )
}
