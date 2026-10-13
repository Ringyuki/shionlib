import { Inline, Tag, Text } from '@hina-ui/react'
import { useMessages } from 'use-intl'
import { PlatformTag } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import type { MoyuEntry } from '../resource-listing'

export function MoyuTags({ entry }: { entry: MoyuEntry }) {
  const labels = useMessages()
  const names = labels.resource
  return (
    <Inline gap="xs" align="center">
      <Tag size="lg" variant="solid">
        {names.list.kind[entry.kind]}
      </Tag>
      {(entry.platform ?? []).map(platform => (
        <PlatformTag key={platform} platform={platform} size="lg" />
      ))}
      {(entry.language ?? []).map(language => (
        <Tag key={language} size="lg" variant="outline">
          {labelOf(labels.game.language, language)}
        </Tag>
      ))}
      {entry.translation === 'machine' && (
        <Tag size="lg" tone="warning">
          {names.translationName.machine}
        </Tag>
      )}
      {entry.model !== null && (
        <Tag size="lg" className="max-w-64">
          <Text as="span" size="sm" weight="medium" truncate>
            {entry.model}
          </Text>
        </Tag>
      )}
      {entry.translator !== null && (
        <Tag size="lg" variant="outline" className="max-w-full">
          <Text as="span" size="sm" weight="medium" truncate>
            {entry.translator}
          </Text>
        </Tag>
      )}
    </Inline>
  )
}
