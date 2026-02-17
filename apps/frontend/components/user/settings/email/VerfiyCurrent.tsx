import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from '@/components/shionui/Form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/shionui/InputOTP'
import { Input } from '@/components/shionui/Input'
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
import { Control, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { forwardRef, useImperativeHandle } from 'react'

interface VerfiyCurrentProps {
  currentEmail: string
  onSubmit: (data: z.infer<typeof verifyCodeSchemaInterface>) => void
}
export const verifyCodeSchemaInterface = z.object({
  verify_code: z.string().length(6),
})

export const VerfiyCurrent = forwardRef(({ currentEmail, onSubmit }: VerfiyCurrentProps, ref) => {
  const t = useTranslations('Components.User.Settings.EmailFlow.step1')
  const verifyCodeSchema = z.object({
    verify_code: z.string().length(6, t('validation.verifyCode')),
  })
  const form = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      verify_code: '',
    },
  })

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      form.handleSubmit(handleOnSubmit)()
    },
  }))
  const handleOnSubmit = (data: z.infer<typeof verifyCodeSchema>) => {
    onSubmit(data)
  }
  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormItem>
          <FormLabel>{t('currentEmail')}</FormLabel>
          <FormControl>
            <Input value={currentEmail} readOnly disabled />
          </FormControl>
        </FormItem>
        <FormField
          control={form.control as Control<z.infer<typeof verifyCodeSchema>>}
          name="verify_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('verifyCode')}</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                  value={(field.value ?? '').toUpperCase()}
                  onChange={val => field.onChange(val.toUpperCase())}
                  pasteTransformer={p => p.toUpperCase()}
                  className="max-w-full!"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
})

VerfiyCurrent.displayName = 'VerfiyCurrent'
