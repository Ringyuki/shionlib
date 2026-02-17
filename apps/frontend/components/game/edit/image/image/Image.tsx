import { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { gameImageSchemaType } from '../Form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/shionui/Input'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Upload } from './Upload'
import { useState } from 'react'

interface ImageProps {
  form: UseFormReturn<z.infer<typeof gameImageSchemaType>>
}

export const Image = ({ form }: ImageProps) => {
  const t = useTranslations('Components.Game.Edit.Image.EditContent')
  const [tempUrl, setTempUrl] = useState<string | null>(null)

  const handleUpload = (url: string, dims: number[]) => {
    form.setValue('url', url)
    setTempUrl(null)
    form.setValue('dims', dims)
  }
  return (
    <>
      <FormField
        control={form.control}
        name="url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('url')}</FormLabel>
            <div className="flex items-center gap-2">
              <div className="w-24 h-24 md:w-40 md:h-40 overflow-hidden bg-muted rounded-md shrink-0">
                <FadeImage
                  src={tempUrl ?? field.value}
                  alt={t('url')}
                  imageClassName="object-contain h-full w-full"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Input readOnly value={field.value} />
                <Upload onUpload={handleUpload} onTempUrl={setTempUrl} />
                <FormMessage />
              </div>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="dims"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('dims')}</FormLabel>
            <Input readOnly value={field.value.join(' × ')} />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
