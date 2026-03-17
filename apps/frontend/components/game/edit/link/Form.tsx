'use client'

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/shionui/Button'

export type LinkFormValues = {
  url: string
  label: string
  name: string
}

interface LinkFormProps {
  defaultValues?: Partial<LinkFormValues>
  onSubmit: (data: LinkFormValues) => void
  loading: boolean
  submitLabel?: string
}

export const LinkForm = ({ defaultValues, onSubmit, loading, submitLabel }: LinkFormProps) => {
  const t = useTranslations('Components.Game.Edit.Link.Form')

  const linkSchema = z.object({
    url: z
      .string()
      .nonempty({ message: t('validation.url') })
      .url({ message: t('validation.url_format') }),
    label: z.string().nonempty({ message: t('validation.label') }),
    name: z.string().nonempty({ message: t('validation.name') }),
  })

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      url: defaultValues?.url ?? '',
      label: defaultValues?.label ?? '',
      name: defaultValues?.name ?? '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('url')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('url_placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('label')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('label_placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('name_placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={loading} className="w-full">
          {submitLabel ?? t('submit')}
        </Button>
      </form>
    </Form>
  )
}
