import { GameCover } from '@/interfaces/game/game.interface'
import {
  LanguageOptions,
  CoverTypeOptions,
  Language,
  CoverType,
} from '@/interfaces/game/game.interface'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
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
import { Image as ImageField } from './image/Image'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/shionui/Button'

interface CoverFormProps {
  cover: GameCover
  onSubmit: (data: z.infer<typeof gameCoverSchemaType>) => void
  loading: boolean
}

const languageValues = LanguageOptions.map(option => option.value) as [Language, ...Language[]]
const coverTypeValues = CoverTypeOptions.map(option => option.value) as [CoverType, ...CoverType[]]

export const gameCoverSchemaType = z.object({
  url: z.string().nonempty(),
  dims: z.array(z.number()).nonempty(),
  language: z.enum(languageValues),
  type: z.enum(coverTypeValues),
  sexual: z.number().min(0).max(2),
  violence: z.number().min(0).max(2),
})

export const CoverForm = ({ cover, onSubmit, loading }: CoverFormProps) => {
  const t = useTranslations('Components.Game.Edit.Cover.EditContent')

  const gameCoverSchema = z.object({
    url: z.string().nonempty({ message: t('validation.url') }),
    dims: z.array(z.number()).nonempty({ message: t('validation.dims') }),
    language: z.enum(languageValues, { message: t('validation.language') }),
    type: z.enum(coverTypeValues, { message: t('validation.type') }),
    sexual: z
      .number()
      .min(0)
      .max(2, { message: t('validation.sexual') }),
    violence: z
      .number()
      .min(0)
      .max(2, { message: t('validation.violence') }),
  })

  const form = useForm<z.infer<typeof gameCoverSchema>>({
    resolver: zodResolver(gameCoverSchema),
    defaultValues: cover,
  })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ImageField form={form} />
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('language')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  {LanguageOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('type')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {CoverTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
