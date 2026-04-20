import { ArrowDown, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { cn } from '@/utils/cn'
import { DIFF_BADGE_CLASSNAME } from './constants'
import { formatPath, type DiffEntry } from './helpers'
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

const isEmptyDiffValue = (value: unknown) => value === null || value === undefined || value === ''
const isStringLikeDiffValue = (value: unknown) =>
  typeof value === 'string' || isEmptyDiffValue(value)
const toStringDiffValue = (value: unknown) => (isEmptyDiffValue(value) ? '' : String(value))

const ArrayDiffPanel = ({ oldValue, value }: { oldValue: string[]; value: string[] }) => {
  const oldSet = new Set(oldValue)
  const newSet = new Set(value)
  const added = value.filter(v => !oldSet.has(v))
  const removed = oldValue.filter(v => !newSet.has(v))
  const unchanged = oldValue.filter(v => newSet.has(v))

  return (
    <div className="flex flex-wrap gap-1">
      {unchanged.map(v => (
        <Badge key={v} intent="neutral" appearance="soft" className="text-xs">
          {v}
        </Badge>
      ))}
      {removed.map(v => (
        <Badge key={v} intent="destructive" appearance="soft" className="text-xs line-through">
          {v}
        </Badge>
      ))}
      {added.map(v => (
        <Badge key={v} intent="success" appearance="soft" className="text-xs">
          {v}
        </Badge>
      ))}
    </div>
  )
}

export const FieldDiffItem = ({ entry, labels }: FieldDiffItemProps) => {
  const path = formatPath(entry.path, labels.root)
  const isCreate = entry.type === 'CREATE'
  const isRemove = entry.type === 'REMOVE'
  const isChange = entry.type === 'CHANGE'
  const useStringDiff =
    isChange &&
    (typeof entry.oldValue === 'string' || typeof entry.value === 'string') &&
    isStringLikeDiffValue(entry.oldValue) &&
    isStringLikeDiffValue(entry.value)
  const useArrayDiff =
    isChange &&
    Array.isArray(entry.oldValue) &&
    Array.isArray(entry.value) &&
    (entry.oldValue as unknown[]).every(v => typeof v === 'string') &&
    (entry.value as unknown[]).every(v => typeof v === 'string')
  const badgeClass = isCreate
    ? DIFF_BADGE_CLASSNAME.CREATE
    : isRemove
      ? DIFF_BADGE_CLASSNAME.REMOVE
      : DIFF_BADGE_CLASSNAME.CHANGE

  return (
    <div className="rounded-md border border-border p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge intent="neutral" appearance="outline" className="font-mono! text-xs">
          {labels.path}: {path}
        </Badge>
        <Badge
          intent="neutral"
          appearance="outline"
          className={cn('font-mono! text-xs', badgeClass)}
        >
          {isCreate ? labels.added : isRemove ? labels.removed : labels.updated}
        </Badge>
      </div>

      {isChange &&
        (useStringDiff ? (
          <StringDiffPanel
            before={toStringDiffValue(entry.oldValue)}
            after={toStringDiffValue(entry.value)}
            beforeLabel={labels.before}
            afterLabel={labels.after}
            emptyLabel={labels.empty}
          />
        ) : useArrayDiff ? (
          <ArrayDiffPanel oldValue={entry.oldValue as string[]} value={entry.value as string[]} />
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
