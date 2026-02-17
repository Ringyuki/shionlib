import { useTranslations } from 'next-intl'
import { z } from 'zod'
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/shionui/Card'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { shionlibRequest } from '@/utils/request'
import { useRouter } from '@/i18n/navigation.client'
import { useEffect } from 'react'

const checkToken = async (token: string, email: string) => {
  const response = await shionlibRequest().post<boolean>('/auth/password/forget/check', {
    data: {
      token,
      email,
    },
  })
  return response.data
}

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/

export const resetSchema = z
  .object({
    password: z.string().min(8).regex(passwordRegex),
    password_confirm: z.string().min(8).regex(passwordRegex),
  })
  .refine(data => data.password === data.password_confirm, {
    path: ['password_confirm'],
  })

interface ResetProps {
  token: string
  email: string
  onSubmit: (data: z.infer<typeof resetSchema>) => void
  loading: boolean
}

export const Reset = ({ token, email, onSubmit, loading }: ResetProps) => {
  const t = useTranslations('Components.Common.Auth.Password.Forget.Reset')

  const router = useRouter()
  useEffect(() => {
    const check = async () => {
      const isValid = await checkToken(token, email)
      if (!isValid) {
        router.push('/user/password/forget')
      }
    }
    check()
  }, [token, email, router])

  const resetSchema = z
    .object({
      password: z
        .string()
        .min(8, t('validation.password'))
        .regex(passwordRegex, t('validation.passwordRegex')),
      password_confirm: z
        .string()
        .min(8, t('validation.passwordConfirm'))
        .regex(passwordRegex, t('validation.passwordRegex')),
    })
    .refine(data => data.password === data.password_confirm, {
      path: ['password_confirm'],
      message: t('validation.passwordDiff'),
    })

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      password_confirm: '',
    },
  })

  const handleSubmit = (data: z.infer<typeof resetSchema>) => {
    onSubmit(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="sm:w-96 w-[calc(100vw-2rem)]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password')}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password_confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('passwordConfirm')}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" loading={loading}>
              {t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
