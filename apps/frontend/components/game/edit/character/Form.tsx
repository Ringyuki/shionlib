'use client'

import { GameCharacterRelation } from '@/interfaces/game/game.interface'
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
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/shionui/Button'
import { Image as ImageField } from './image/Image'

interface CharacterRelationFormProps {
  relation: GameCharacterRelation
  onSubmit: (data: z.infer<typeof characterRelationSchemaType>) => void
  loading: boolean
}

const ROLE_OPTIONS = ['main', 'primary', 'side', 'appears'] as const
type RoleType = (typeof ROLE_OPTIONS)[number]
const roleValues = ROLE_OPTIONS as unknown as [RoleType, ...RoleType[]]

export const characterRelationSchemaType = z.object({
  role: z.enum(roleValues).nullable(),
  actor: z.string().nullable(),
  image: z.string().nullable(),
})

export const CharacterRelationForm = ({
  relation,
  onSubmit,
  loading,
}: CharacterRelationFormProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Form')

  const characterRelationSchema = z.object({
    role: z.enum(roleValues).nullable(),
    actor: z.string().nullable(),
    image: z.string().nullable(),
  })

  const form = useForm<z.infer<typeof characterRelationSchema>>({
    resolver: zodResolver(characterRelationSchema),
    defaultValues: {
      role: relation.role ?? null,
      actor: relation.actor ?? null,
      image: relation.image ?? null,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ImageField form={form} />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('role')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('role_placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLE_OPTIONS.map(role => (
                    <SelectItem key={role} value={role}>
                      {t(`role_${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="actor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('actor')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} placeholder={t('actor_placeholder')} />
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
