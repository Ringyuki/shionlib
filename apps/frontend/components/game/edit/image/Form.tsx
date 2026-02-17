import { GameImage } from '@/interfaces/game/game.interface'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Image as ImageField } from './image/Image'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/shionui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'

interface ImageFormProps {
  image: GameImage
  onSubmit: (data: z.infer<typeof gameImageSchemaType>) => void
  loading: boolean
}

export const gameImageSchemaType = z.object({
  url: z.string().nonempty(),
  dims: z.array(z.number()).nonempty(),
  sexual: z.number().min(0).max(2),
  violence: z.number().min(0).max(2),
})

export const ImageForm = ({ image, onSubmit, loading }: ImageFormProps) => {
  const t = useTranslations('Components.Game.Edit.Image.EditContent')

  const gameImageSchema = z.object({
    url: z.string().nonempty({ message: t('validation.url') }),
    dims: z.array(z.number()).nonempty({ message: t('validation.dims') }),
    sexual: z
      .number()
      .min(0)
      .max(2, { message: t('validation.sexual') }),
    violence: z
      .number()
      .min(0)
      .max(2, { message: t('validation.violence') }),
  })

  const form = useForm<z.infer<typeof gameImageSchema>>({
    resolver: zodResolver(gameImageSchema),
    defaultValues: image,
  })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ImageField form={form} />
        <FormField
          control={form.control}
          name="sexual"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sexual')}</FormLabel>
              <Tabs
                value={field.value.toString()}
                onValueChange={value => field.onChange(Number(value))}
              >
                <TabsList>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <TabsTrigger key={index} id={`sexual-${index}`} value={index.toString()}>
                      <span className="px-3">{index}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="violence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('violence')}</FormLabel>
              <Tabs
                value={field.value.toString()}
                onValueChange={value => field.onChange(Number(value))}
              >
                <TabsList>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <TabsTrigger key={index} id={`violence-${index}`} value={index.toString()}>
                      <span className="px-3">{index}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
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
