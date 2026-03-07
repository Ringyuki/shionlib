'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquare, Pencil } from 'lucide-react'
import { Separator } from '@/components/shionui/Separator'
import { Button } from '@/components/shionui/Button'
import { Textarea } from '@/components/shionui/Textarea'
import { BBCodeContent } from '@/components/common/content/BBCode'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { useShionlibUserStore } from '@/store/userStore'

interface HistoryItemReasonProps {
  historyId: number
  initialReason: string | null
  operatorId: number
}

export const HistoryItemReason = ({
  historyId,
  initialReason,
  operatorId,
}: HistoryItemReasonProps) => {
  const t = useTranslations('Components.Game.Download.History')
  const { user } = useShionlibUserStore()
  const [isEditing, setIsEditing] = useState(false)
  const [reason, setReason] = useState(initialReason)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  const canEdit = user.id === operatorId
  if (!reason && !canEdit) return null

  const handleEdit = () => {
    setDraft(reason ?? '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await shionlibRequest().patch(`/game/download-source/file-history/${historyId}/reason`, {
        data: { reason: draft || undefined },
      })
      setReason(draft || null)
      setIsEditing(false)
      sileo.success({ title: t('editReasonSuccess') })
    } catch {
      sileo.error({ title: t('editReasonError') })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <>
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{t('reason')}</span>
          </div>
          {canEdit && !isEditing && (
            <Button
              size="xs"
              intent="neutral"
              appearance="ghost"
              onClick={handleEdit}
              renderIcon={<Pencil />}
            >
              {reason ? t('editReason') : t('addReason')}
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="pl-6 flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={t('editReasonPlaceholder')}
              maxLength={500}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                intent="primary"
                appearance="solid"
                loading={loading}
                onClick={handleSave}
              >
                {t('saveReason')}
              </Button>
              <Button size="sm" intent="neutral" appearance="ghost" onClick={handleCancel}>
                {t('cancelEdit')}
              </Button>
            </div>
          </div>
        ) : (
          reason && (
            <div className="pl-6">
              <BBCodeContent
                content={reason}
                className="text-sm text-muted-foreground whitespace-pre-wrap wrap-break-word"
              />
            </div>
          )
        )}
      </div>
    </>
  )
}
