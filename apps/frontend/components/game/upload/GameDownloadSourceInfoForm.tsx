import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from '@/components/shionui/Form'
import { Textarea } from '@/components/shionui/Textarea'
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectValue,
} from '@/components/shionui/MultiSelect'
import { useTranslations } from 'next-intl'
import { Control, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Platform,
  Language,
  PlatformOptions,
  LanguageOptions,
} from '@/interfaces/game/game.interface'
import { Button } from '@/components/shionui/Button'
import { cn } from '@/utils/cn'
import { Switch } from '@/components/shionui/animated/Switch'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/shionui/Input'
import isEqual from 'lodash/isEqual'

const platformValues = PlatformOptions.map(option => option.value) as [Platform, ...Platform[]]
const languageValues = LanguageOptions.map(option => option.value) as [Language, ...Language[]]

interface GameDownloadSourceFormValues {
  file_name: string
  platform: Platform[]
  language: Language[]
  note: string
}
const normalizeInitialValues = (
  values?: Partial<GameDownloadSourceFormValues>,
): GameDownloadSourceFormValues => ({
  file_name: values?.file_name ?? '',
  platform: values?.platform ?? [],
  language: values?.language ?? [],
  note: values?.note ?? '',
})

export const gameDownloadSourceSchemaType = z.object({
  file_name: z.string().nonempty().max(255),
  platform: z.enum(platformValues).array().min(1),
  language: z.enum(languageValues).array().min(1),
  note: z.string().optional(),
})

interface GameDownloadSourceInfoFormProps {
  className?: string
  onSubmit: (data: z.infer<typeof gameDownloadSourceSchemaType>) => void
  loading: boolean
  initialValues?: Partial<z.infer<typeof gameDownloadSourceSchemaType>>
  autoSubmitTrigger?: number
}

export const GameDownloadSourceInfoForm = ({
  className,
  onSubmit,
  loading,
  initialValues,
  autoSubmitTrigger,
}: GameDownloadSourceInfoFormProps) => {
  const t = useTranslations('Components.Game.Upload.GameUploadDialog')

  const gameDownloadSourceSchema = z.object({
    file_name: z
      .string()
      .nonempty({ message: t('validation.fileNameRequired') })
      .max(255, { message: t('validation.fileNameLength', { length: 255 }) }),
    platform: z.enum(platformValues).array().min(1, t('validation.platform')),
    language: z.enum(languageValues).array().min(1, t('validation.language')),
    note: z.string().max(255, t('validation.note')),
  })
  const form = useForm<z.infer<typeof gameDownloadSourceSchema>>({
    resolver: zodResolver(gameDownloadSourceSchema),
    defaultValues: normalizeInitialValues(initialValues),
  })
  const syncedInitialValuesRef = useRef<Partial<GameDownloadSourceFormValues>>(initialValues ?? {})
  useEffect(() => {
    if (!initialValues) return
    const partialInitialValues = initialValues as Partial<GameDownloadSourceFormValues>
    const syncField = <K extends keyof GameDownloadSourceFormValues>(key: K) => {
      if (!Object.prototype.hasOwnProperty.call(partialInitialValues, key)) return
      const nextValue = partialInitialValues[key]
      if (nextValue === undefined) return
      const castNextValue = nextValue as GameDownloadSourceFormValues[K]
      if (isEqual(syncedInitialValuesRef.current[key], castNextValue)) return
      syncedInitialValuesRef.current[key] = castNextValue
      form.setValue(key, castNextValue as any, {
        shouldDirty: false,
        shouldTouch: false,
      })
    }
    syncField('file_name')
    syncField('platform')
    syncField('language')
    syncField('note')
  }, [initialValues, form])
  const platform = useWatch({ control: form.control, name: 'platform' })
  const language = useWatch({ control: form.control, name: 'language' })

  const [autoSubmitTouched, setAutoSubmitTouched] = useState(false)
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(false)
  const canToggleAutoSubmit = platform.length > 0 && language.length > 0

  useEffect(() => {
    if (!canToggleAutoSubmit) {
      setAutoSubmitEnabled(false)
      setAutoSubmitTouched(false)
      return
    }
    if (!autoSubmitTouched) {
      setAutoSubmitEnabled(true)
    }
  }, [canToggleAutoSubmit, autoSubmitTouched])

  const handleAutoSubmitSwitchChange = (checked: boolean) => {
    setAutoSubmitTouched(true)
    setAutoSubmitEnabled(checked)
  }
  const handleSubmit = useCallback(
    async (data: z.infer<typeof gameDownloadSourceSchema>) => {
      onSubmit(data)
    },
    [onSubmit],
  )

  const lastAutoSubmitTriggerRef = useRef<number | undefined>(autoSubmitTrigger)
  useEffect(() => {
    if (autoSubmitTrigger === undefined || lastAutoSubmitTriggerRef.current === autoSubmitTrigger)
      return
    lastAutoSubmitTriggerRef.current = autoSubmitTrigger
    if (!autoSubmitEnabled || !canToggleAutoSubmit || loading) return
    form.handleSubmit(handleSubmit)()
  }, [autoSubmitTrigger, autoSubmitEnabled, canToggleAutoSubmit, loading, form, handleSubmit])

  return (
    <div className={cn('flex flex-col', className)}>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          {autoSubmitTrigger !== undefined && (
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div className="space-y-2 pr-4">
                <p className="text-sm font-medium">{t('autoSubmitLabel')}</p>
                <p className="text-xs text-muted-foreground">{t('autoSubmitDescription')}</p>
              </div>
              <Switch
                checked={autoSubmitEnabled}
                onCheckedChange={handleAutoSubmitSwitchChange}
                disabled={!canToggleAutoSubmit}
              />
            </div>
          )}
          <FormField
            control={form.control as Control<z.infer<typeof gameDownloadSourceSchema>>}
            name="file_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fileName')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={255} placeholder={t('fileNamePlaceholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          ></FormField>
          <FormField
            control={form.control as Control<z.infer<typeof gameDownloadSourceSchema>>}
            name="platform"
            render={() => (
              <FormItem>
                <FormLabel>{t('platform')}</FormLabel>
                <FormControl>
                  <MultiSelect
                    value={platform}
                    onValueChange={values =>
                      form.setValue('platform', values as Platform[], {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                  >
                    <MultiSelectTrigger className="w-full">
                      <MultiSelectValue
                        placeholder={t('platformPlaceholder')}
                        resolveLabel={v => PlatformOptions.find(p => p.value === v)?.label ?? v}
                      />
                    </MultiSelectTrigger>
                    <MultiSelectContent>
                      {PlatformOptions.map(platform => (
                        <MultiSelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectContent>
                  </MultiSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          ></FormField>
          <FormField
            control={form.control as Control<z.infer<typeof gameDownloadSourceSchema>>}
            name="language"
            render={() => (
              <FormItem>
                <FormLabel>{t('language')}</FormLabel>
                <FormControl>
                  <MultiSelect
                    value={language}
                    onValueChange={values =>
                      form.setValue('language', values as Language[], {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                  >
                    <MultiSelectTrigger className="w-full">
                      <MultiSelectValue
                        placeholder={t('languagePlaceholder')}
                        resolveLabel={v => LanguageOptions.find(l => l.value === v)?.label ?? v}
                      />
                    </MultiSelectTrigger>
                    <MultiSelectContent>
                      {LanguageOptions.map(language => (
                        <MultiSelectItem key={language.value} value={language.value}>
                          {language.label}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectContent>
                  </MultiSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          ></FormField>
          <FormField
            control={form.control as Control<z.infer<typeof gameDownloadSourceSchema>>}
            name="note"
            render={() => (
              <FormItem>
                <FormLabel>{t('note')}</FormLabel>
                <FormControl>
                  <Textarea {...form.register('note')} placeholder={t('notePlaceholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          ></FormField>
          <Button type="submit" className="w-full" loading={loading}>
            {t('submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
