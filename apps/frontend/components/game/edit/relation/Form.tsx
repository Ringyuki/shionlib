'use client'

import { GameRelation, GameRelationTypeOptions } from '@/interfaces/game/game.interface'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from '@/components/shionui/Form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/shionui/Button'

const relationValues = GameRelationTypeOptions.map(o => o.value) as [string, ...string[]]

export const relationSchemaType = z.object({
  relation: z.enum(relationValues),
})

interface RelationFormProps {
  relation: GameRelation
  onSubmit: (data: z.infer<typeof relationSchemaType>) => void
  loading: boolean
}

export const RelationForm = ({ relation, onSubmit, loading }: RelationFormProps) => {
  const t = useTranslations('Components.Game.Edit.Relation')

  const form = useForm<z.infer<typeof relationSchemaType>>({
    resolver: zodResolver(relationSchemaType),
    defaultValues: {
      relation: relation.relation,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="relation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Form.relationType')}</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GameRelationTypeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {t(`relationType.${o.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={loading} className="w-full">
          {t('Form.submit')}
        </Button>
      </form>
    </Form>
  )
}
