import { Chip, Inline } from '@hina-ui/react'
import { Hash } from 'lucide-react'
import { useFormatter, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import type { Condition, LibraryAddress } from '../library'

type AppliedConditionsProps = {
  conditions: readonly Condition[]
  onChange: (changes: Partial<LibraryAddress>) => void
  className?: string
}

export function AppliedConditions({ conditions, onChange, className }: AppliedConditionsProps) {
  const t = useTranslations('library')
  const labels = useMessages().game.platform
  const format = useFormatter()
  const text = ({ kind, value }: Condition) => {
    switch (kind) {
      case 'platform':
        return labelOf(labels, value)
      case 'month':
        return format.dateTime(new Date(`2000-${value.padStart(2, '0')}-15T00:00:00Z`), {
          month: 'short',
          timeZone: 'UTC',
        })
      case 'resources':
        return t(value === 'any' ? 'condition.any' : 'condition.required')
      default:
        return t(`condition.${kind}`, { value })
    }
  }
  return (
    <Inline gap="xs" role="group" aria-label={t('filters.applied')} className={className}>
      {conditions.map(condition => (
        <Chip
          key={`${condition.kind}:${condition.value}`}
          size="sm"
          removable
          onRemove={() => onChange(condition.without)}
          icon={condition.kind === 'tag' ? <Hash aria-hidden /> : undefined}
        >
          {text(condition)}
        </Chip>
      ))}
    </Inline>
  )
}
