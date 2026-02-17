import { Input } from '@/components/shionui/Input'
import { Textarea } from '@/components/shionui/Textarea'
import { useTranslations } from 'next-intl'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shionui/Form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Control } from 'react-hook-form'
import { Button } from '@/components/shionui/Button'
import { Checkbox } from '@/components/shionui/Checkbox'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { cn } from '@/utils/cn'

interface FavoriteEditContentProps {
  favorite: Favorite
  onSuccess: (favorite: Favorite) => void
  className?: string
}

export const FavoriteEditContent = ({
  favorite,
  onSuccess,
  className,
}: FavoriteEditContentProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Edit.Content')
  const [loading, setLoading] = useState(false)

  const favoriteEditFormSchema = z.object({
    name: z
      .string()
      .min(1, t('validation.nameMinLength', { length: 1 }))
      .max(12, t('validation.nameMaxLength', { length: 12 })),
    description: z
      .string()
      .max(200, t('validation.descriptionMaxLength', { length: 200 }))
      .optional(),
    is_private: z.boolean(),
  })

  const form = useForm<z.infer<typeof favoriteEditFormSchema>>({
    resolver: zodResolver(favoriteEditFormSchema),
    defaultValues: {
      name: favorite.name,
      description: favorite.description ?? undefined,
      is_private: favorite.is_private,
    },
  })

  const onSubmit = async (data: z.infer<typeof favoriteEditFormSchema>) => {
    try {
      setLoading(true)
      const { data: updated } = await shionlibRequest().patch<Favorite>(
        `/favorites/${favorite.id}`,
        {
          data,
        },
      )
      const updatedFavorite = {
        ...favorite,
        ...data,
        ...(updated ?? {}),
      }
      onSuccess?.(updatedFavorite)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
    } catch {
    } finally {
      setLoading(false)
    }
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('space-y-4', className)}>
        {!favorite.default && (
          <FormField
            control={form.control as Control<z.infer<typeof favoriteEditFormSchema>>}
            name="name"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={12} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}
        <FormField
          control={form.control as Control<z.infer<typeof favoriteEditFormSchema>>}
          name="description"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t('description')}</FormLabel>
                <FormControl>
                  <Textarea {...field} maxLength={200} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={form.control as Control<z.infer<typeof favoriteEditFormSchema>>}
          name="is_private"
          render={({ field }) => {
            return (
              <FormItem className="flex items-center gap-2">
                <FormLabel>{t('is_private')}</FormLabel>
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <Button type="submit" className="w-full" loading={loading}>
          {t('submit')}
        </Button>
      </form>
    </Form>
  )
}
