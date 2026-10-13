import { Callout, Inline, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

export function GuestNotice() {
  const t = useTranslations('sponsor.checkout')
  return (
    <Callout>
      <Inline gap="md" align="center" justify="between">
        <Text as="span" size="sm">
          {t('guest')}
        </Text>
        <Button variant="outline" tone="neutral" size="sm" loginRequired>
          {t('signIn')}
        </Button>
      </Inline>
    </Callout>
  )
}
