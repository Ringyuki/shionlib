'use client'

import { Button } from '@/components/shionui/Button'
import { useShionlibUserStore } from '@/store/userStore'
import { useTranslations } from 'next-intl'
import { Control, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/shionui/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shionui/Form'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { User } from '@/interfaces/user/user.interface'
import { Link, usePathname, useRouter } from '@/i18n/navigation.client'
import { useLocale } from 'next-intl'

interface LoginProps {
  onSuccess?: () => void
}

export const Login = ({ onSuccess }: LoginProps) => {
  const t = useTranslations('Components.Common.User.Login')
  const { setUser } = useShionlibUserStore()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const loginSchema = z.object({
    identifier: z.string().min(1, t('validation.identifier')),
    password: z.string().min(8, t('validation.password')),
  })

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  })

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      setLoading(true)
      await shionlibRequest({ forceThrowError: true }).post('/user/login', { data })
      try {
        const data = await shionlibRequest().get<User>('/user/me')
        setUser(data.data!)
        router.refresh()
        onSuccess?.()
        // toast.success(t('success'))
        sileo.success({ title: t('success') })
        const targetLocale = data.data?.lang || 'en'
        if (targetLocale === locale) return
        router.replace(pathname, { locale: targetLocale })
      } catch {}
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const [loading, setLoading] = useState(false)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control as Control<z.infer<typeof loginSchema>>}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('identifier')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as Control<z.infer<typeof loginSchema>>}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input {...field} type="password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="text-right text-sm">
          <Link
            href="/user/password/forget"
            onClick={() => onSuccess?.()}
            className="text-primary hover:underline"
          >
            {t('forgetPassword')}
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          {t('login')}
        </Button>
      </form>
    </Form>
  )
}
