'use client'

import { useTranslations } from 'next-intl'
import type { ComponentType, PropsWithChildren } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/shionui/Button'
import { ReportForm, ReportFormValues } from './ReportForm'

interface ReportContentProps {
  form: UseFormReturn<ReportFormValues>
  loading: boolean
  onSubmit: (data: ReportFormValues) => Promise<void>
  Footer: ComponentType<PropsWithChildren>
  contentClassName?: string
}

export const ReportContent = ({ form, loading, onSubmit, Footer }: ReportContentProps) => {
  const t = useTranslations('Components.Game.Download.Report')
  const handleSubmit = form.handleSubmit(onSubmit)

  return (
    <>
      <ReportForm form={form} />
      <Footer>
        <Button intent="destructive" loading={loading} onClick={handleSubmit} loginRequired>
          {t('submit')}
        </Button>
      </Footer>
    </>
  )
}
