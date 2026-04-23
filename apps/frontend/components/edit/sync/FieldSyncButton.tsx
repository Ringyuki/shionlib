'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/shionui/Button'
import { useRouter } from '@/i18n/navigation.client'
import { shionlibRequest } from '@/utils/request'
import { FieldSyncModal } from './FieldSyncModal'
import type { FieldSyncBatchPreview, FieldSyncPreview, FieldSyncTarget } from '../types/field-sync'

interface FieldSyncButtonProps<TField extends FieldSyncTarget> {
  fields: TField[]
  batchPreviewEndpoint: string
  batchPreviewData?: (fields: TField[]) => Record<string, unknown>
  applyEndpoint: (field: TField) => string
  applyData: (field: TField, candidateIds: string[]) => Record<string, unknown>
  onApplied?: (fields: TField[]) => void
  getFieldLabel?: (field: TField) => string
}

export const FieldSyncButton = <TField extends FieldSyncTarget>({
  fields,
  batchPreviewEndpoint,
  batchPreviewData,
  applyEndpoint,
  applyData,
  onApplied,
  getFieldLabel,
}: FieldSyncButtonProps<TField>) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')
  const router = useRouter()
  const syncFields = fields
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [previews, setPreviews] = useState<FieldSyncPreview<TField>[]>([])
  const [selected, setSelected] = useState<Partial<Record<TField, string[]>>>({})

  const loadPreviews = async () => {
    if (syncFields.length === 0) return

    setLoading(true)
    setPreviews([])
    setSelected({})
    try {
      const { nextPreviews, failed } = await loadBatchPreviews(syncFields)

      if (nextPreviews.length === 0) {
        sileo.error({ title: failed ? t('previewFailed') : t('empty') })
        return
      }
      if (failed) sileo.error({ title: t('previewFailed') })

      setPreviews(nextPreviews)
      setSelected(
        Object.fromEntries(
          nextPreviews.map(preview => [
            preview.field,
            preview.candidates
              .filter(candidate => candidate.applicable && candidate.defaultSelected)
              .map(candidate => candidate.id),
          ]),
        ) as Partial<Record<TField, string[]>>,
      )
      setOpen(true)
    } catch {
      sileo.error({ title: t('previewFailed') })
    } finally {
      setLoading(false)
    }
  }

  const loadBatchPreviews = async (fields: TField[]) => {
    const res = await shionlibRequest().post<
      FieldSyncBatchPreview<TField> | FieldSyncPreview<TField>[]
    >(batchPreviewEndpoint, {
      data: batchPreviewData?.(fields) ?? { fields },
    })
    if (!res.data) return { nextPreviews: [], failed: true }

    const batch = Array.isArray(res.data) ? { previews: res.data, failedFields: [] } : res.data

    return {
      nextPreviews: batch.previews.filter(preview => preview.candidates.length > 0),
      failed: (batch.failedFields?.length ?? 0) > 0,
    }
  }

  const applySelected = async () => {
    const entries = previews
      .map(preview => ({
        field: preview.field,
        candidateIds: selected[preview.field] ?? [],
      }))
      .filter(entry => entry.candidateIds.length > 0)
    if (entries.length === 0) return

    setApplying(true)
    try {
      const results = await Promise.allSettled(
        entries.map(async entry => {
          const res = await shionlibRequest().post<{ applied: number }>(
            applyEndpoint(entry.field),
            {
              data: applyData(entry.field, entry.candidateIds),
            },
          )
          return { field: entry.field, applied: res.data?.applied ?? 0 }
        }),
      )
      const applied = results.flatMap(result => {
        if (result.status !== 'fulfilled' || result.value.applied === 0) return []
        return [result.value]
      })
      const failed = results.some(result => result.status === 'rejected')
      const appliedCount = applied.reduce((sum, result) => sum + result.applied, 0)

      if (appliedCount > 0 || !failed) {
        sileo.success({ title: t('applySuccess', { count: appliedCount }) })
      }
      if (appliedCount > 0) {
        onApplied?.(applied.map(result => result.field))
        router.refresh()
      }
      if (failed) {
        sileo.error({ title: t('applyFailed') })
        return
      }

      setOpen(false)
    } finally {
      setApplying(false)
    }
  }

  if (syncFields.length === 0) return null

  return (
    <>
      <Button
        type="button"
        intent="secondary"
        appearance="outline"
        size="sm"
        onClick={loadPreviews}
        loading={loading}
        renderIcon={<RefreshCw className="size-4" />}
      >
        {t('button')}
      </Button>
      <FieldSyncModal
        open={open}
        onOpenChange={setOpen}
        previews={previews}
        selected={selected}
        setSelected={setSelected}
        applying={applying}
        onApply={applySelected}
        getFieldLabel={getFieldLabel}
      />
    </>
  )
}
