import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import { Modal } from '@/components/shionui/Modal'
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/shionui/animated/Tabs'
import { ToggleGroup } from '@/components/shionui/ToggleGroup'
import { filterCandidates } from './candidate-filter'
import { FieldSyncCandidateCard } from './FieldSyncCandidateCard'
import { FieldSyncFooter } from './FieldSyncFooter'
import { FieldSyncSummary } from './FieldSyncSummary'
import { FieldSyncToolbar } from './FieldSyncToolbar'
import type { FieldSyncPreview, FieldSyncTarget } from '../types/field-sync'
import { ScrollArea } from '@/components/shionui/ScrollArea'

interface FieldSyncModalProps<TField extends FieldSyncTarget = FieldSyncTarget> {
  open: boolean
  onOpenChange: (open: boolean) => void
  previews: FieldSyncPreview<TField>[]
  selected: Partial<Record<TField, string[]>>
  setSelected: Dispatch<SetStateAction<Partial<Record<TField, string[]>>>>
  applying: boolean
  onApply: () => void
  getFieldLabel?: (field: TField) => string
}

export const FieldSyncModal = <TField extends FieldSyncTarget = FieldSyncTarget>({
  open,
  onOpenChange,
  previews,
  selected,
  setSelected,
  applying,
  onApply,
  getFieldLabel,
}: FieldSyncModalProps<TField>) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')
  const [activeField, setActiveField] = useState<TField | undefined>(undefined)
  const [queries, setQueries] = useState<Partial<Record<TField, string>>>({})
  const resolvedActiveField = previews.some(preview => preview.field === activeField)
    ? activeField
    : previews[0]?.field
  const selectedCount = useMemo(
    () =>
      (Object.values(selected) as Array<string[] | undefined>).reduce(
        (sum, ids) => sum + (ids?.length ?? 0),
        0,
      ),
    [selected],
  )

  const setFieldSelected = (field: TField, value: string[] | ((current: string[]) => string[])) => {
    setSelected(prev => {
      const current = prev[field] ?? []
      const next = typeof value === 'function' ? value(current) : value
      return { ...prev, [field]: next }
    })
  }

  const setFieldQuery = (field: TField, query: string) => {
    setQueries(prev => ({ ...prev, [field]: query }))
  }

  const fieldLabel = (field: TField) => getFieldLabel?.(field) ?? t(`field.${field}` as any)

  return (
    <Modal
      open={open}
      onOpenChange={next => {
        if (!next) {
          setActiveField(undefined)
          setQueries({})
        }
        onOpenChange(next)
      }}
      title={t('button')}
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
      {resolvedActiveField && (
        <Tabs
          value={resolvedActiveField}
          onValueChange={value => setActiveField(value as TField)}
          className="overflow-hidden"
        >
          <TabsList variant="underlined" scrollAreaClassName="bg-transparent">
            {previews.map(preview => {
              const fieldSelectedCount = selected[preview.field]?.length ?? 0

              return (
                <TabsTrigger key={preview.field} value={preview.field} className="gap-2">
                  {fieldLabel(preview.field)}
                  <Badge
                    intent={fieldSelectedCount > 0 ? 'primary' : 'neutral'}
                    appearance={fieldSelectedCount > 0 ? 'soft' : 'outline'}
                    size="sm"
                  >
                    {fieldSelectedCount}/{preview.candidates.length}
                  </Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <TabsContents>
            {previews.map(preview => {
              const query = queries[preview.field] ?? ''
              const visibleCandidates = filterCandidates(preview.candidates, query)

              return (
                <TabsContent key={preview.field} value={preview.field} className="space-y-4">
                  <FieldSyncSummary preview={preview} />
                  <FieldSyncToolbar
                    query={query}
                    onQueryChange={next => setFieldQuery(preview.field, next)}
                    onSelectRecommended={() =>
                      setFieldSelected(
                        preview.field,
                        preview.candidates
                          .filter(candidate => candidate.applicable && candidate.defaultSelected)
                          .map(candidate => candidate.id),
                      )
                    }
                    onClearSelection={() => setFieldSelected(preview.field, [])}
                  />
                  <ScrollArea className="max-h-[55vh]">
                    <ToggleGroup
                      type="multiple"
                      value={selected[preview.field] ?? []}
                      onValueChange={value => setFieldSelected(preview.field, value)}
                      className="w-full flex-col items-stretch gap-3"
                    >
                      {visibleCandidates.map(candidate => (
                        <FieldSyncCandidateCard key={candidate.id} candidate={candidate} />
                      ))}
                    </ToggleGroup>
                  </ScrollArea>
                </TabsContent>
              )
            })}
          </TabsContents>
        </Tabs>
      )}
    </Modal>
  )
}
