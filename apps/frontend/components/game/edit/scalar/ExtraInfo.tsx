'use client'

import { FormLabel } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { KeyValueArrayInput } from '@/components/common/form/KeyValueArrayInput'
import type { ReactNode } from 'react'

interface ExtraInfoProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const ExtraInfo = ({ form, syncAction }: ExtraInfoProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FormLabel>{t('extra_info')}</FormLabel>
        {syncAction && <div className="shrink-0">{syncAction}</div>}
      </div>
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
