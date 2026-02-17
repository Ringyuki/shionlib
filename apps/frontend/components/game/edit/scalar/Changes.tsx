import { Separator } from '@/components/shionui/Separator'
import { Badge } from '@/components/shionui/Badge'
import { EditChanges } from '@/components/user/home/edits/EditChanges'
import { useTranslations } from 'next-intl'
import { ChangesResult } from '@/utils/pick-changes'

interface ChangesProps {
  changes: ChangesResult | null
}

export const Changes = ({ changes }: ChangesProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar.Changes')
  return (
    <div className="space-y-2">
      {changes && changes.field_changes && changes.field_changes.length > 0 && (
        <div className="flex gap-1 items-center">
          <span className="text-sm text-muted-foreground">{t('fieldChanges')}</span>
          <div className="flex flex-wrap gap-2">
            {changes.field_changes.map((field, index) => (
              <Badge key={index} variant="neutral" className="font-mono! text-xs">
                {field}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <Separator />
      {changes && changes.before && changes.after && (
        <EditChanges changes={{ before: changes.before, after: changes.after }} />
      )}
    </div>
  )
}
