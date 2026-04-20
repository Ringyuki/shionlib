import { FieldDiffItem, type FieldDiffLabels } from './FieldDiffItem'
import { RelationListSection } from './RelationListSection'
import { formatPath, parseEditChanges } from './helpers'

export interface ChangeDiffLabels extends FieldDiffLabels {
  noDifferences: string
}

interface ChangeDiffProps {
  changes: unknown
  labels: ChangeDiffLabels
}

export const ChangeDiff = ({ changes, labels }: ChangeDiffProps) => {
  const { added, removed, diffs } = parseEditChanges(changes)

  if (added.length === 0 && removed.length === 0 && diffs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-3">
        {labels.noDifferences}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {added.length > 0 && (
        <RelationListSection
          title={labels.added}
          items={added}
          tone="add"
          emptyLabel={labels.empty}
        />
      )}

      {removed.length > 0 && (
        <RelationListSection
          title={labels.removed}
          items={removed}
          tone="remove"
          emptyLabel={labels.empty}
        />
      )}

      {diffs.length > 0 && (
        <div className="flex flex-col gap-2">
          {diffs.map((entry, index) => (
            <FieldDiffItem
              key={`${entry.type}-${formatPath(entry.path, labels.root)}-${index}`}
              entry={entry}
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  )
}
