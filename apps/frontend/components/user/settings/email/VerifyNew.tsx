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
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Control } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { forwardRef, useImperativeHandle, useState } from 'react'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { verficationCodeUtil } from '@/utils/verification-code'
import { useCountdown } from '@/hooks/useCountdown'

interface VerifyNewProps {
  onSubmit: (data: z.infer<typeof verifyNewSchemaInterface>) => void
}
export const verifyNewSchemaInterface = z.object({
  new_email: z.email(),
  verify_code: z.string().length(6),
  new_email_code_uuid: z.string(),
})

export const VerifyNew = forwardRef(({ onSubmit }: VerifyNewProps, ref) => {
  const t = useTranslations('Components.User.Settings.EmailFlow.step2')

  const verifyNewSchema = z.object({
    new_email: z.email({ message: t('validation.email') }),
    verify_code: z.string().length(6, t('validation.verifyCode')),
    new_email_code_uuid: z.string(),
  })
  const form = useForm<z.infer<typeof verifyNewSchema>>({
    resolver: zodResolver(verifyNewSchema),
    defaultValues: {
      new_email: '',
      verify_code: '',
      new_email_code_uuid: '',
    },
  })

  const [isGettingCode, setIsGettingCode] = useState(false)
  const [newEmailCodeUuid, setNewEmailCodeUuid] = useState<string | null>(null)
  const { countdown, isCountingDown, startCountdown } = useCountdown({ duration: 60 })
  const getVerifyCode = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!form.getValues('new_email') || form.formState.errors.new_email) {
      // toast.error(t('validation.email'))
      sileo.error({ title: t('validation.email') })
      form.setFocus('new_email')
      return
    }
    try {
      setIsGettingCode(true)
      const data = await verficationCodeUtil().get(form.getValues('new_email'))
      if (data.data?.uuid) {
        setNewEmailCodeUuid(data.data.uuid)
        // toast.success(t('verifyCodeSent'))
        sileo.success({ title: t('verifyCodeSent') })
        startCountdown()
      }
    } catch {
    } finally {
      setIsGettingCode(false)
    }
  }

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      form.handleSubmit(handleOnSubmit)()
    },
  }))
  const handleOnSubmit = (data: z.infer<typeof verifyNewSchemaInterface>) => {
    onSubmit({
      ...data,
      new_email_code_uuid: newEmailCodeUuid ?? '',
    })
  }
  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control as Control<z.infer<typeof verifyNewSchema>>}
          name="new_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('newEmail')}</FormLabel>
              <FormControl>
                <div className="flex w-full items-center gap-2">
                  <Input {...field} />
                  <Button
                    appearance="outline"
                    onClick={getVerifyCode}
                    loading={isGettingCode}
                    disabled={isCountingDown}
                  >
                    {isCountingDown ? `${countdown}s` : t('getVerifyCode')}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as Control<z.infer<typeof verifyNewSchema>>}
          name="verify_code"
          render={({ field }) => (
            <FormItem>
              <>
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
              </>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
})

VerifyNew.displayName = 'VerifyNew'
