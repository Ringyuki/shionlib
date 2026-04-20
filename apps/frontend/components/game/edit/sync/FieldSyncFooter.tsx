import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { Button } from '@/components/shionui/Button'

interface FieldSyncFooterProps {
  selectedCount: number
  applying: boolean
  onApply: () => void
  onCancel: () => void
}

export const FieldSyncFooter = ({
  selectedCount,
  applying,
  onApply,
  onCancel,
}: FieldSyncFooterProps) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-muted-foreground">{t('selected', { count: selectedCount })}</div>
      <div className="flex gap-2">
        <Button type="button" intent="secondary" appearance="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          onClick={onApply}
          disabled={selectedCount === 0}
          loading={applying}
          renderIcon={<Check className="size-4" />}
        >
          {t('apply')}
        </Button>
      </div>
    </div>
  )
}
