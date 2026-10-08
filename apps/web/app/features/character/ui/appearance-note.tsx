import { Inline, Tag, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { voiceOf, type Appearance } from '../character'

export function AppearanceNote({ appearance }: { appearance: Appearance }) {
  const t = useTranslations('character.cast')
  const voice = voiceOf(appearance)
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Tag size="sm" className="shrink-0">
        {t(`role.${appearance.role}`)}
      </Tag>
      {voice !== undefined && (
        <Text size="xs" tone="muted" truncate>
          {t('voice', { name: voice })}
        </Text>
      )}
    </Inline>
  )
}
