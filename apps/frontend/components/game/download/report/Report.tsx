'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createReportFormSchema, ReportFormValues, ReportForm } from './ReportForm'
import { Modal } from '@/components/shionui/Modal'
import { Button } from '@/components/shionui/Button'

interface ReportProps {
  id: number
  onSuccess: (id: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadingChange: (loading: boolean) => void
}

const reportFormDefaultValues: Partial<ReportFormValues> = {
  detail: '',
}

export const Report = ({ id, onSuccess, open, onOpenChange, onLoadingChange }: ReportProps) => {
  const t = useTranslations('Components.Game.Download.Report')
  const [loading, setLoading] = useState(false)
  const reportFormSchema = createReportFormSchema(t)
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: reportFormDefaultValues,
  })

  useEffect(() => {
    onOpenChange(open)
  }, [open, onOpenChange])

  useEffect(() => {
    onLoadingChange(loading)
  }, [loading, onLoadingChange])

  const reset = () => {
    form.reset(reportFormDefaultValues as ReportFormValues)
  }

  const handleSubmit = async (data: ReportFormValues) => {
    try {
      setLoading(true)
      await shionlibRequest().post(`/game/download-source/${id}/report`, {
        data: {
          reason: data.reason,
          detail: data.detail?.trim() || undefined,
        },
      })
      sileo.success({ title: t('success') })
      onOpenChange(false)
      onSuccess(id)
      reset()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      reset()
    }
  }

  return (
    <Modal
      title={t('title')}
      description={t('description')}
      tone="destructive"
      open={open}
      onOpenChange={handleOpenChange}
      footer={
        <Button
          intent="destructive"
          loading={loading}
          onClick={form.handleSubmit(handleSubmit)}
          loginRequired
        >
          {t('submit')}
        </Button>
      }
    >
      <ReportForm form={form} />
    </Modal>
  )
}
