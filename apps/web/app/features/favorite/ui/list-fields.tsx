import { Checkbox, FormField, Input, Textarea } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import type { ListValues } from '../favorite.schema'

type ListFieldsProps = {
  values: ListValues
  onValuesChange: (values: ListValues) => void
  named: boolean
}

export function ListFields({ values, onValuesChange, named }: ListFieldsProps) {
  const t = useTranslations('favorite')
  return (
    <>
      {named && (
        <FormField
          name="name"
          label={t('listName')}
          description={t('listNameHint', lengthOf('CreateFavoriteInputBody', 'name'))}
          required
        >
          <Input
            value={values.name}
            onValueChange={name => onValuesChange({ ...values, name })}
            placeholder={t('listNamePlaceholder')}
            autoFocus
          />
        </FormField>
      )}
      <FormField
        name="description"
        label={t('listDescription')}
        description={t('listDescriptionHint', lengthOf('CreateFavoriteInputBody', 'description'))}
      >
        <Textarea
          value={values.description}
          onValueChange={description => onValuesChange({ ...values, description })}
          autosize={{ minRows: 2, maxRows: 6 }}
        />
      </FormField>
      <FormField name="isPrivate">
        <Checkbox
          checked={values.isPrivate}
          onCheckedChange={checked => onValuesChange({ ...values, isPrivate: checked === true })}
          description={t('makePrivateHint')}
        >
          {t('makePrivate')}
        </Checkbox>
      </FormField>
    </>
  )
}
