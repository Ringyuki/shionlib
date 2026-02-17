'use client'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { Control, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Button } from '../shionui/Button'
import { Switch } from '../shionui/animated/Switch'
import { useShionlibUserStore } from '@/store/userStore'
import { UserRole } from '@/interfaces/user/user.interface'

export const createGameFormSchema = z.object({
  vndbId: z.string().min(1),
  bangumiId: z.string().min(1),
  skipConsistencyCheck: z.boolean().optional(),
})

interface CreateGameFormProps {
  onSubmit: (data: z.infer<typeof createGameFormSchema>) => void
  loading: boolean
}

export const CreateGameForm = ({ onSubmit, loading }: CreateGameFormProps) => {
  const t = useTranslations('Components.Create.Form')
  const { user } = useShionlibUserStore()

  const createGameFormSchema = z.object({
    vndbId: z.string().min(1, { message: t('validation.vndbId') }),
    bangumiId: z.string().min(1, { message: t('validation.bangumiId') }),
    skipConsistencyCheck: z.boolean().optional(),
  })
  const form = useForm<z.infer<typeof createGameFormSchema>>({
    resolver: zodResolver(createGameFormSchema),
    defaultValues: {
      vndbId: '',
      bangumiId: '',
      skipConsistencyCheck: false,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control as Control<z.infer<typeof createGameFormSchema>>}
          name="vndbId"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t('vndbIdLabel')}</FormLabel>
                <FormDescription>{t('vndbIdDescription')}</FormDescription>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={event => {
                      const sanitizedValue = event.target.value
                        .toLowerCase()
                        .replace(/[^v0-9]/g, '')
                      field.onChange(sanitizedValue)
                    }}
                    inputMode="text"
                    pattern="[v0-9]*"
                    placeholder={t('vndbIdPlaceholder')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={form.control as Control<z.infer<typeof createGameFormSchema>>}
          name="bangumiId"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t('bangumiIdLabel')}</FormLabel>
                <FormDescription>{t('bangumiIdDescription')}</FormDescription>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={event => {
                      const digitsOnly = event.target.value.replace(/[^0-9]/g, '')
                      field.onChange(digitsOnly)
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('bangumiIdPlaceholder')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        {user.role >= UserRole.ADMIN && (
          <FormField
            control={form.control as Control<z.infer<typeof createGameFormSchema>>}
            name="skipConsistencyCheck"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('skipConsistencyCheckLabel')}</FormLabel>
                  <FormDescription>{t('skipConsistencyCheckDescription')}</FormDescription>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}
        <Button type="submit" loading={loading} loginRequired>
          {t('submit')}
        </Button>
      </form>
    </Form>
  )
}
