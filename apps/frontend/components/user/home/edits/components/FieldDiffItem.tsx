import { Badge } from '@/components/shionui/Badge'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { DIFF_BADGE_CLASSNAME } from '../constants/edit-changes'
import { DiffEntry, formatPath } from '../helpers/edit-changes'
import { ChangeValuePanel } from './ChangeValuePanel'
import { StringDiffPanel } from './StringDiffPanel'

export interface FieldDiffLabels {
  empty: string
  path: string
  root: string
  before: string
  after: string
  added: string
  removed: string
  updated: string
}

interface FieldDiffItemProps {
  entry: DiffEntry
  labels: FieldDiffLabels
}

export const FieldDiffItem = ({ entry, labels }: FieldDiffItemProps) => {
  const path = formatPath(entry.path, labels.root)
  const isCreate = entry.type === 'CREATE'
  const isRemove = entry.type === 'REMOVE'
  const isChange = entry.type === 'CHANGE'
  const useStringDiff =
    isChange && typeof entry.oldValue === 'string' && typeof entry.value === 'string'
  const badgeClass = isCreate
    ? DIFF_BADGE_CLASSNAME.CREATE
    : isRemove
      ? DIFF_BADGE_CLASSNAME.REMOVE
      : DIFF_BADGE_CLASSNAME.CHANGE

  return (
    <div className="rounded-md border border-border p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="neutral" className="font-mono! text-xs">
          {labels.path}: {path}
        </Badge>
        <Badge variant="neutral" className={cn('font-mono! text-xs', badgeClass)}>
          {isCreate ? labels.added : isRemove ? labels.removed : labels.updated}
        </Badge>
      </div>

      {isChange &&
        (useStringDiff ? (
          <StringDiffPanel
            before={entry.oldValue}
            after={entry.value}
            beforeLabel={labels.before}
            afterLabel={labels.after}
            emptyLabel={labels.empty}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{labels.before}</span>
              <ChangeValuePanel value={entry.oldValue} tone="remove" emptyLabel={labels.empty} />
            </div>
            <div className="flex items-center justify-center pt-6">
              <ArrowRight className="size-4 text-muted-foreground md:block hidden" />
              <ArrowDown className="size-4 text-muted-foreground md:hidden block" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{labels.after}</span>
              <ChangeValuePanel value={entry.value} tone="add" emptyLabel={labels.empty} />
            </div>
          </div>
        ))}

      {isCreate && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{labels.after}</span>
          <ChangeValuePanel value={entry.value} tone="add" emptyLabel={labels.empty} />
        </div>
      )}

      {isRemove && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{labels.before}</span>
          <ChangeValuePanel value={entry.oldValue} tone="remove" emptyLabel={labels.empty} />
        </div>
      )}
    </div>
  )
}
