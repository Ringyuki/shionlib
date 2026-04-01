import { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { characterRelationSchemaType } from '../Form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { ImageUpload } from '@/components/common/uploaders/ImageUpload'
import { Question } from '@/components/common/content/Question'
import { useParams } from 'next/navigation'
import { sileo } from 'sileo'

interface ImageProps {
  form: UseFormReturn<z.infer<typeof characterRelationSchemaType>>
}

export const Image = ({ form }: ImageProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Image.Image')
  const tUpload = useTranslations('Components.Game.Edit.Character.Image.Upload')
  const { id: character_id } = useParams()

  return (
    <FormField
      control={form.control}
      name="image"
      render={() => (
        <FormItem>
          <FormLabel>
            {t('image')}
            <Question content={t('image_question')} />
          </FormLabel>
          <ImageUpload
            endpoint={`/uploads/small/character/${character_id}/image`}
            value={form.watch('image')}
            onUpload={key => form.setValue('image', key)}
            selectLabel={tUpload('select')}
            uploadLabel={tUpload('upload')}
            onSuccess={() => sileo.success({ title: tUpload('success') })}
            showInput
            readOnly
            previewClassName="w-24 h-24 md:w-40 md:h-40"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
