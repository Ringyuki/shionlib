'use client'

import { useTranslations } from 'next-intl'
import { Control, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shionui/Form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { Textarea } from '@/components/shionui/Textarea'

export const reportReasons = [
  'MALWARE',
  'IRRELEVANT',
  'BROKEN_LINK',
  'MISLEADING_CONTENT',
  'OTHER',
] as const

export type ReportReason = (typeof reportReasons)[number]

export const reportFormSchemaType = z.object({
  reason: z.enum(reportReasons),
  detail: z.string().max(500).optional(),
})

export type ReportFormValues = z.infer<typeof reportFormSchemaType>

export const createReportFormSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    reason: z.enum(reportReasons, { message: t('validation.reason') }),
    detail: z
      .string()
      .max(500, t('validation.detailMaxLength', { length: 500 }))
      .optional(),
  })

interface ReportFormProps {
  form: UseFormReturn<ReportFormValues>
}

export const ReportForm = ({ form }: ReportFormProps) => {
  const t = useTranslations('Components.Game.Download.Report')

  return (
    <Form {...form}>
      <div className="flex flex-col gap-3">
        <FormField
          control={form.control as Control<ReportFormValues>}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('reason')}</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('reasonPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {reportReasons.map(item => (
                      <SelectItem key={item} value={item}>
                        {t(`reasons.${item}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control as Control<ReportFormValues>}
          name="detail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('detail')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  placeholder={t('detailPlaceholder')}
                  maxLength={500}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Form>
  )
}
