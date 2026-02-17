'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/shionui/Drawer'
import { ReportContent } from './ReportContent'
import { ReportFormValues } from './ReportForm'

interface ReportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<ReportFormValues>
  loading: boolean
  onSubmit: (data: ReportFormValues) => Promise<void>
}

export const ReportDrawer = ({
  open,
  onOpenChange,
  form,
  loading,
  onSubmit,
}: ReportDrawerProps) => {
  const t = useTranslations('Components.Game.Download.Report')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">
          <ReportContent
            form={form}
            loading={loading}
            onSubmit={onSubmit}
            Footer={({ children }) => <DrawerFooter className="p-0 pt-4">{children}</DrawerFooter>}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
