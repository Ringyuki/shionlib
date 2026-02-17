'use client'

import { FormLabel } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { KeyValueArrayInput } from '@/components/common/form/KeyValueArrayInput'

interface ExtraInfoProps {
  form: UseFormReturn<GameScalar>
}

export const ExtraInfo = ({ form }: ExtraInfoProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')

  return (
    <div className="flex flex-col gap-2">
      <FormLabel>{t('extra_info')}</FormLabel>
      <KeyValueArrayInput
        form={form}
        name="extra_info"
        fields={[
          { fieldKey: 'key', placeholder: t('extra_info_key_placeholder') },
          { fieldKey: 'value', placeholder: t('extra_info_value_placeholder') },
        ]}
        emptyItem={{ key: '', value: '' }}
        addButtonText={t('add_extra_info')}
      />
    </div>
  )
}
