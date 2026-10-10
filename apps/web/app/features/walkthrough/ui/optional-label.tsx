import { Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'

export function OptionalLabel({ children }: { children: ReactNode }) {
  const t = useTranslations('walkthrough')
  return (
    <>
      {children}
      <Text as="span" size="sm" tone="muted" className="ms-2">
        {t('optional')}
      </Text>
    </>
  )
}
