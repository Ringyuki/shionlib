'use client'

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'
import { ImageUpload } from '@/components/common/uploaders/ImageUpload'
import { sileo } from 'sileo'
import { useParams } from 'next/navigation'

interface LogoProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Logo = ({ form }: LogoProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  const { id: developer_id } = useParams()

  return (
    <FormField
      control={form.control}
      name="logo"
      render={() => (
        <FormItem>
          <FormLabel>{t('logo')}</FormLabel>
          <FormControl>
            <ImageUpload
              endpoint={`/uploads/small/developer/${developer_id}/logo`}
              value={form.watch('logo')}
              onUpload={key => form.setValue('logo', key)}
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
