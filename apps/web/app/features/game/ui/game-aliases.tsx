import { Text, Tooltip } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { useOverflowing } from '~/shared/ui/use-overflowing'

export function GameAliases({ aliases }: { aliases: readonly string[] }) {
  const t = useTranslations('game.facts')
  const format = useFormatter()
  const { ref, overflowing } = useOverflowing<HTMLParagraphElement>()
  if (aliases.length === 0) {
    return null
  }
  const names = format.list(aliases)
  return (
    <Tooltip content={names} disabled={!overflowing}>
      <Text
        ref={ref}
        size="xs"
        tone="faint"
        truncate
        tabIndex={overflowing ? 0 : undefined}
        className="w-fit max-w-[min(65ch,100%)]"
      >
        {t('aliases', { names })}
      </Text>
    </Tooltip>
  )
}
