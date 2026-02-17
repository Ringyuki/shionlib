import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useForm, Control } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { forwardRef, useImperativeHandle } from 'react'

interface PasswordFormProps {
  onSubmit: (data: z.infer<typeof passwordSchemaInterface>) => void
}
export const passwordSchemaInterface = z.object({
  current_password: z.string().min(8),
  password: z.string().min(8),
  password_confirm: z.string().min(8),
})

export const PasswordForm = forwardRef(({ onSubmit }: PasswordFormProps, ref) => {
  const t = useTranslations('Components.User.Settings.PasswordForm')

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/
  const passwordSchema = z
    .object({
      current_password: z
        .string()
        .min(8, t('validation.currentPassword'))
        .regex(passwordRegex, t('validation.passwordRegex')),
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

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      password: '',
      password_confirm: '',
    },
  })

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      form.handleSubmit(handleOnSubmit)()
    },
  }))
  const handleOnSubmit = (data: z.infer<typeof passwordSchema>) => {
    onSubmit(data)
  }

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control as Control<z.infer<typeof passwordSchema>>}
          name="current_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('currentPassword')}</FormLabel>
              <FormControl>
                <Input {...field} type="password" maxLength={50} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as Control<z.infer<typeof passwordSchema>>}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input {...field} type="password" maxLength={50} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as Control<z.infer<typeof passwordSchema>>}
          name="password_confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordConfirm')}</FormLabel>
              <FormControl>
                <Input {...field} type="password" maxLength={50} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
})

PasswordForm.displayName = 'PasswordForm'
