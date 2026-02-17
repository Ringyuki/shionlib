import { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { characterRelationSchemaType } from '../Form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/shionui/Input'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { ImageUpload } from './Upload'
import { useState } from 'react'
import { Question } from '@/components/common/content/Question'

interface ImageProps {
  form: UseFormReturn<z.infer<typeof characterRelationSchemaType>>
}

export const Image = ({ form }: ImageProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Image.Image')
  const [tempUrl, setTempUrl] = useState<string | null>(null)

  const handleUpload = (imageKey: string) => {
    form.setValue('image', imageKey)
    setTempUrl(null)
  }
  return (
    <>
      <FormField
        control={form.control}
        name="image"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t('image')}
              <Question content={t('image_question')} />
            </FormLabel>
            <div className="flex items-center gap-2">
              <div className="w-24 h-24 md:w-40 md:h-40 overflow-hidden bg-muted rounded-md shrink-0">
                <FadeImage
                  src={tempUrl || field.value || ''}
                  alt={t('image')}
                  imageClassName="object-contain h-full w-full"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Input readOnly value={field.value || ''} />
                <ImageUpload onUpload={handleUpload} onTempUrl={setTempUrl} />
                <FormMessage />
              </div>
            </div>
          </FormItem>
        )}
      />
    </>
  )
}
