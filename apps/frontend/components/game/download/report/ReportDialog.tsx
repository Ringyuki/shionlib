'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import { ReportContent } from './ReportContent'
import { ReportFormValues } from './ReportForm'

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<ReportFormValues>
  loading: boolean
  onSubmit: (data: ReportFormValues) => Promise<void>
}

export const ReportDialog = ({
  open,
  onOpenChange,
  form,
  loading,
  onSubmit,
}: ReportDialogProps) => {
  const t = useTranslations('Components.Game.Download.Report')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tone="destructive" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <ReportContent form={form} loading={loading} onSubmit={onSubmit} Footer={DialogFooter} />
      </DialogContent>
    </Dialog>
  )
}
