'use client'

import { FormLabel } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { KeyValueArrayInput } from '@/components/common/form/KeyValueArrayInput'
import type { ReactNode } from 'react'

interface StaffsProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Staffs = ({ form, syncAction }: StaffsProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FormLabel>{t('staffs')}</FormLabel>
        {syncAction && <div className="shrink-0">{syncAction}</div>}
      </div>
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
