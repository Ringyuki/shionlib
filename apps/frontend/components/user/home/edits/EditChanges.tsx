'use client'

import { ArrowRightLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FieldDiffItem, FieldDiffLabels } from './components/FieldDiffItem'
import { RelationListSection } from './components/RelationListSection'
import { formatPath, parseEditChanges } from './helpers/edit-changes'

interface EditChangesProps {
  changes: unknown
}

export const EditChanges = ({ changes }: EditChangesProps) => {
  const t = useTranslations('Components.User.Home.Edits.EditChanges')
  const { added, removed, diffs } = parseEditChanges(changes)

  const labels: FieldDiffLabels = {
    empty: t('empty'),
    path: t('path'),
    root: t('root'),
    before: t('before'),
    after: t('after'),
    added: t('added'),
    removed: t('removed'),
    updated: t('updated'),
  }

  if (added.length === 0 && removed.length === 0 && diffs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-3">
        {t('noDifferences')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('changes')}</span>
      </div>

      {added.length > 0 && (
        <RelationListSection
          title={t('added')}
          items={added}
          tone="add"
          emptyLabel={labels.empty}
        />
      )}

      {removed.length > 0 && (
        <RelationListSection
          title={t('removed')}
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
