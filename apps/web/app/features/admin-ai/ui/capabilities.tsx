import { Inline, Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'

const shown = ['moderation', 'reasoning', 'vision'] as const

type CapabilitiesProps = {
  of: Record<(typeof shown)[number], boolean>
}

export function Capabilities({ of }: CapabilitiesProps) {
  const t = useTranslations('adminAi.capability')
  return (
    <Inline gap="xs" align="center" wrap={false}>
      {shown
        .filter(capability => of[capability])
        .map(capability => (
          <Tag key={capability} variant="outline" tone="neutral">
            {t(capability)}
          </Tag>
        ))}
    </Inline>
  )
}
