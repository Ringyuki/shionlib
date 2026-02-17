import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/shionui/Card'
import { useTranslations } from 'next-intl'
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface GetEmailProps {
  onSubmit: (data: z.infer<typeof getEmailSchema>) => void
  loading: boolean
  isCountingDown: boolean
  countdown: number
}

export const getEmailSchema = z.object({
  email: z.email(),
})

export const GetEmail = ({ onSubmit, loading, isCountingDown, countdown }: GetEmailProps) => {
  const t = useTranslations('Components.Common.Auth.Password.Forget.GetEmail')

  const formSchema = z.object({
    email: z.email({ message: t('validation.email') }),
  })
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  })

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
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
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" loading={loading} disabled={isCountingDown}>
              {t('submit') + (isCountingDown ? ` (${countdown}s)` : '')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
