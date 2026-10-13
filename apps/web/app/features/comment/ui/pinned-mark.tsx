import { Inline, Text } from '@hina-ui/react'
import { Pin } from 'lucide-react'
import { useTranslations } from 'use-intl'

export function PinnedMark() {
  const t = useTranslations('comment')
  return (
    <Inline gap="xs" align="center" wrap={false} className="pt-1 text-muted">
      <Pin aria-hidden className="size-3.5" />
      <Text as="span" size="xs" tone="muted" weight="medium">
        {t('pinnedBy')}
      </Text>
    </Inline>
  )
}
