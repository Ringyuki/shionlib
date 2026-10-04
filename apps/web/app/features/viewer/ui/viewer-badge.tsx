import { Avatar, Inline, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'

type ViewerBadgeProps = {
  viewer: Schema<'UserMeDTO'> | null
}

export function ViewerBadge({ viewer }: ViewerBadgeProps) {
  const t = useTranslations('viewer')
  if (viewer === null) {
    return (
      <Text size="sm" tone="muted">
        {t('guest')}
      </Text>
    )
  }
  return (
    <Inline gap="sm" align="center">
      <Avatar src={viewer.avatar ?? undefined} name={viewer.name} size="sm" />
      <Text size="sm">{viewer.name}</Text>
    </Inline>
  )
}
