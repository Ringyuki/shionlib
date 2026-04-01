'use client'

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import { ImageUpload } from '@/components/common/uploaders/ImageUpload'
import { sileo } from 'sileo'
import { useParams } from 'next/navigation'

interface ImageProps {
  form: UseFormReturn<CharacterScalar>
}

export const Image = ({ form }: ImageProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  const { id: character_id } = useParams()

  return (
    <FormField
      control={form.control}
      name="image"
      render={() => (
        <FormItem>
          <FormLabel>{t('image')}</FormLabel>
          <FormControl>
            <ImageUpload
              endpoint={`/uploads/small/character/${character_id}/image`}
              value={form.watch('image')}
              onUpload={key => form.setValue('image', key)}
              selectLabel={t('select_file')}
              uploadLabel={t('upload')}
              onSuccess={() => sileo.success({ title: t('upload_success') })}
              showInput
              readOnly
              placeholder="https://..."
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
