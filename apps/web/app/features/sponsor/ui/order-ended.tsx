import { Inline, Result } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { sponsorPaths } from '../sponsor'

type OrderEndedProps = {
  stage: 'expired' | 'refunded'
  open: boolean
}

export function OrderEnded({ stage, open }: OrderEndedProps) {
  const t = useTranslations('sponsor.ended')
  const locale = useLocale()
  const paths = sponsorPaths(locale)
  const retriable = stage === 'expired' && open
  return (
    <Result
      status={stage === 'expired' ? 'warning' : 'info'}
      size="lg"
      title={t(stage)}
      actions={
        <Inline gap="sm" justify="center">
          {retriable && (
            <Button asChild>
              <Link to={paths.checkout}>{t('retry')}</Link>
            </Button>
          )}
          <Button
            asChild
            variant={retriable ? 'outline' : 'solid'}
            tone={retriable ? 'neutral' : 'accent'}
          >
            <Link to={paths.wall}>{t('back')}</Link>
          </Button>
        </Inline>
      }
    />
  )
}
