'use client'

import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'
import { cn } from '@/utils/cn'

export const bindFormSchema = z.object({
  pvn_user_name: z.string().min(1),
  pvn_password: z.string().min(1),
})

export type BindFormValues = z.infer<typeof bindFormSchema>

interface BindFormProps {
  onSubmit: (data: BindFormValues) => void
  onCancel: () => void
  isSubmitting: boolean
  className?: string
}

export const BindForm = ({ onSubmit, onCancel, isSubmitting, className }: BindFormProps) => {
  const t = useTranslations('Components.User.Settings.Connections.PotatoVN.BindModal')

  const schema = z.object({
    pvn_user_name: z.string().min(1, t('validation.usernameRequired')),
    pvn_password: z.string().min(1, t('validation.passwordRequired')),
  })

  const form = useForm<BindFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pvn_user_name: '', pvn_password: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('flex flex-col gap-4', className)}>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <FormField
          control={form.control}
          name="pvn_user_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('username')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('usernamePlaceholder')}
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pvn_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            appearance="ghost"
            intent="neutral"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" intent="primary" loading={isSubmitting}>
            {t('connect')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
