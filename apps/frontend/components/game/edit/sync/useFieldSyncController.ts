import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'
import { shionlibRequest } from '@/utils/request'
import { applyEndpoint, isScalarSyncField, previewEndpoint } from './endpoints'
import type { FieldSyncPreview, FieldSyncTarget } from './types'

interface UseFieldSyncControllerParams {
  gameId: number
  field: FieldSyncTarget
  onApplied: () => void | Promise<void>
}

export const useFieldSyncController = ({
  gameId,
  field,
  onApplied,
}: UseFieldSyncControllerParams) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [preview, setPreview] = useState<FieldSyncPreview | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const loadPreview = async () => {
    setPreview(null)
    setSelected({})
    setLoading(true)
    try {
      const res = await shionlibRequest().post<FieldSyncPreview>(previewEndpoint(gameId, field), {
        data: isScalarSyncField(field) ? { field } : undefined,
      })
      const nextPreview = res.data
      const nextCandidates = nextPreview?.candidates ?? []
      if (nextCandidates.length === 0) {
        sileo.error({ title: t('empty') })
        return
      }
      setPreview(nextPreview)
      setSelected(
        Object.fromEntries(
          nextCandidates.map(candidate => [
            candidate.id,
            candidate.applicable && candidate.defaultSelected,
          ]),
        ),
      )
      setOpen(true)
    } catch {
      sileo.error({ title: t('previewFailed') })
    } finally {
      setLoading(false)
    }
  }

  const applySelected = async () => {
    const candidateIds = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([id]) => id)
    if (candidateIds.length === 0) return

    setApplying(true)
    try {
      const res = await shionlibRequest().post<{ applied: number }>(applyEndpoint(gameId, field), {
        data: isScalarSyncField(field) ? { field, candidateIds } : { candidateIds },
      })
      sileo.success({ title: t('applySuccess', { count: res.data?.applied ?? 0 }) })
      await onApplied()
      setOpen(false)
    } catch {
      sileo.error({ title: t('applyFailed') })
    } finally {
      setApplying(false)
    }
  }

  return {
    open,
    setOpen,
    loading,
    applying,
    preview,
    selected,
    setSelected,
    loadPreview,
    applySelected,
  }
}
