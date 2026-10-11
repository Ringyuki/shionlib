import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Heading,
  Inline,
  Stack,
  Tag,
  Text,
} from '@hina-ui/react'
import { Ellipsis, Lock, PencilLine, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { listLabel, type FavoriteList } from '../favorite'

type ListHeadingProps = {
  list: FavoriteList
  total: number
  onEdit?: () => void
  onRemove?: () => void
}

export function ListHeading({ list, total, onEdit, onRemove }: ListHeadingProps) {
  const t = useTranslations('favorite')
  const description = (list.description ?? '').trim()
  return (
    <Inline gap="md" align="start" justify="between" wrap={false} className="w-full">
      <Stack gap="xs" className="min-w-0">
        <Inline gap="sm" align="center">
          <Heading level={2} size="lg" weight="semibold" className="break-all">
            {listLabel(list, t('defaultList'))}
          </Heading>
          {list.is_private && (
            <Tag size="sm" variant="outline">
              <Lock aria-hidden />
              {t('private')}
            </Tag>
          )}
          <Text size="sm" tone="muted" className="tabular-nums">
            {t('gameCount', { count: total })}
          </Text>
        </Inline>
        {description !== '' && (
          <Text size="sm" tone="muted" className="max-w-prose break-words whitespace-pre-line">
            {description}
          </Text>
        )}
      </Stack>
      {onEdit !== undefined && (
        <DropdownMenu
          label={t('listActions')}
          align="end"
          content={
            <>
              <DropdownMenuItem icon={<PencilLine />} onSelect={onEdit}>
                {t('editList')}
              </DropdownMenuItem>
              {onRemove !== undefined && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={onRemove}>
                    {t('removeList')}
                  </DropdownMenuItem>
                </>
              )}
            </>
          }
        >
          <Button variant="ghost" tone="neutral" size="sm" iconOnly aria-label={t('listActions')}>
            <Ellipsis />
          </Button>
        </DropdownMenu>
      )}
    </Inline>
  )
}
