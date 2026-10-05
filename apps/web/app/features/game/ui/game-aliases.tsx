import { Text, Tooltip } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'

export function GameAliases({ aliases }: { aliases: readonly string[] }) {
  const t = useTranslations('game.facts')
  const format = useFormatter()
  if (aliases.length === 0) {
    return null
  }
  const names = format.list(aliases)
  return (
    <Tooltip content={names}>
      <Text size="xs" tone="faint" truncate tabIndex={0} className="max-w-prose">
        {t('aliases', { names })}
      </Text>
    </Tooltip>
  )
}
