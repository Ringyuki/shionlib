import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { filterCandidates } from './candidate-filter'
import { FieldSyncCandidateCard } from './FieldSyncCandidateCard'
import { FieldSyncFooter } from './FieldSyncFooter'
import { FieldSyncSummary } from './FieldSyncSummary'
import { FieldSyncToolbar } from './FieldSyncToolbar'
import type { FieldSyncPreview, FieldSyncTarget } from './types'

interface FieldSyncModalProps {
  field: FieldSyncTarget
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: FieldSyncPreview | null
  selected: Record<string, boolean>
  setSelected: Dispatch<SetStateAction<Record<string, boolean>>>
  applying: boolean
  onApply: () => void
}

export const FieldSyncModal = ({
  field,
  open,
  onOpenChange,
  preview,
  selected,
  setSelected,
  applying,
  onApply,
}: FieldSyncModalProps) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')
  const [query, setQuery] = useState('')
  const candidates = preview?.candidates ?? []
  const visibleCandidates = filterCandidates(candidates, query)
  const selectedCount = Object.values(selected).filter(Boolean).length

  const selectRecommended = () => {
    setSelected(
      Object.fromEntries(
        candidates.map(candidate => [
          candidate.id,
          candidate.applicable && candidate.defaultSelected,
        ]),
      ),
    )
  }

  const clearSelection = () => {
    setSelected(Object.fromEntries(candidates.map(candidate => [candidate.id, false])))
  }

  return (
    <Modal
      open={open}
      onOpenChange={next => {
        if (!next) setQuery('')
        onOpenChange(next)
      }}
      title={t('title', { field: t(`field.${field}`) })}
      description={t('description')}
      dialogClassName="lg:max-w-5xl"
      footer={
        <FieldSyncFooter
          selectedCount={selectedCount}
          applying={applying}
          onApply={onApply}
          onCancel={() => onOpenChange(false)}
        />
      }
    >
      <div className="space-y-4">
        {preview && <FieldSyncSummary preview={preview} />}
        <FieldSyncToolbar
          query={query}
          onQueryChange={setQuery}
          onSelectRecommended={selectRecommended}
          onClearSelection={clearSelection}
        />
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {visibleCandidates.map(candidate => (
            <FieldSyncCandidateCard
              key={candidate.id}
              candidate={candidate}
              checked={!!selected[candidate.id]}
              onCheckedChange={checked =>
                setSelected(prev => ({ ...prev, [candidate.id]: checked }))
              }
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}
