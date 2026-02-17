import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { EditChanges } from '@/components/user/home/edits/EditChanges'
import { Card, CardContent } from '@/components/shionui/Card'
import { Badge } from '@/components/shionui/Badge'
import { Separator } from '@/components/shionui/Separator'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'
import { Avatar } from '@/components/common/user/Avatar'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { Calendar, Info, Hash } from 'lucide-react'
import { Undo } from './Undo'
import { useShionlibUserStore } from '@/store/userStore'

interface HistoryItemProps {
  history: EditRecordItemInterface
  className?: string
}

export const HistoryItem = ({ history, className }: HistoryItemProps) => {
  const t = useTranslations('Components.Game.EditHistory')
  const locale = useLocale()
  const { getUser } = useShionlibUserStore()
  const isAdmin = getUser().role !== 1

  return (
    <Card className={cn('py-0 overflow-hidden', className)}>
      <CardContent className="p-4 flex flex-col gap-3">
        {history.field_changes && history.field_changes.length > 0 && (
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex gap-1 items-center">
              <div className="flex gap-1 items-center">
                <div className="flex items-center gap-2">
                  <Avatar user={history.actor!} />
                  <span className="text-sm font-medium">{history.actor!.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {history.undo_of ? t('undoneOf') : t('fieldChanges')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {history.undo_of ? (
                    <div className="flex items-center gap-0.5 text-muted-foreground text-xs">
                      <Hash className="size-3" />
                      {history.undo_of.id}
                    </div>
                  ) : (
                    history.field_changes.map((field, index) => (
                      <Badge key={index} variant="neutral" className="font-mono! text-xs">
                        {field}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {history.undone_by && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  {t('undone')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-muted-foreground text-xs">
                <Hash className="size-3" />
                {history.id}
              </div>
              <Badge variant="neutral" className="flex items-center gap-1">
                <Calendar className="size-3" />
                {timeFromNow(history.created, locale)}
              </Badge>
            </div>
          </div>
        )}
        {history.note && (
          <div className="text-xs font-light font-mono flex items-center gap-1">
            <Info className="size-3" />
            {history.note}
          </div>
        )}
        <Separator />
        <EditChanges changes={history.changes} />
        {isAdmin && !history.undo && !history.undone_by && (
          <>
            <Separator />
            <div className="flex items-center justify-end">
              <Undo edit_id={history.id} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
