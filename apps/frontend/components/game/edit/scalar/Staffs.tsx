'use client'

import { FormLabel } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { KeyValueArrayInput } from '@/components/common/form/KeyValueArrayInput'

interface StaffsProps {
  form: UseFormReturn<GameScalar>
}

export const Staffs = ({ form }: StaffsProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')

  return (
    <div className="flex flex-col gap-2">
      <FormLabel>{t('staffs')}</FormLabel>
      <KeyValueArrayInput
        form={form}
        name="staffs"
        fields={[
          { fieldKey: 'name', placeholder: t('staff_name_placeholder') },
          { fieldKey: 'role', placeholder: t('staff_role_placeholder') },
        ]}
        emptyItem={{ name: '', role: '' }}
        addButtonText={t('add_staff')}
      />
    </div>
  )
}
