'use client'

import { DeveloperRelation } from '@/interfaces/game/game.interface'
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

interface DeveloperRelationFormProps {
  relation: DeveloperRelation
  onSubmit: (data: z.infer<typeof developerRelationSchemaType>) => void
  loading: boolean
}

export const developerRelationSchemaType = z.object({
  role: z.string().nullable(),
})

export const DeveloperRelationForm = ({
  relation,
  onSubmit,
  loading,
}: DeveloperRelationFormProps) => {
  const t = useTranslations('Components.Game.Edit.Developer.Form')

  const developerRelationSchema = z.object({
    role: z.string().nullable(),
  })

  const form = useForm<z.infer<typeof developerRelationSchema>>({
    resolver: zodResolver(developerRelationSchema),
    defaultValues: {
      role: relation.role ?? null,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('role')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} placeholder={t('role_placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={loading} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </Form>
  )
}
