import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, Inline } from '@hina-ui/react'
import { Ellipsis, PencilLine, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

type ListActionsProps = {
  onCreate: () => void
  onEdit: () => void
  onRemove?: () => void
}

export function ListActions({ onCreate, onEdit, onRemove }: ListActionsProps) {
  const t = useTranslations('favorite')
  return (
    <Inline gap="sm" align="center" wrap={false} className="shrink-0">
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
        <Button variant="outline" tone="neutral" size="sm" iconOnly aria-label={t('listActions')}>
          <Ellipsis />
        </Button>
      </DropdownMenu>
      <Button variant="outline" tone="neutral" size="sm" icon={<Plus />} onClick={onCreate}>
        {t('newList')}
      </Button>
    </Inline>
  )
}
