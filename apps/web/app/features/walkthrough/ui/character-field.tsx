import { FormField, MultiCombobox } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PictureOption } from '~/features/search'
import type { Face } from '../walkthrough'
import { OptionalLabel } from './optional-label'

type CharacterFieldProps = {
  value: readonly number[]
  faces: readonly Face[]
  className?: string
  onValueChange: (value: number[]) => void
}

export function CharacterField({ value, faces, className, onValueChange }: CharacterFieldProps) {
  const t = useTranslations('walkthrough')
  const options = faces.map(face => ({ value: face.id, label: face.name, picture: face.picture }))
  return (
    <FormField
      name="characters"
      label={<OptionalLabel>{t('characters')}</OptionalLabel>}
      className={className}
    >
      <MultiCombobox
        placeholder={t('searchCharacters')}
        value={[...value]}
        options={options}
        onValueChange={chosen =>
          onValueChange(chosen.flatMap(id => faces.find(face => face.id === id)?.id ?? []))
        }
        renderOption={({ option }) => (
          <PictureOption
            name={option.label}
            detail={undefined}
            picture={{ src: option.picture, shape: 'portrait' }}
          />
        )}
      />
    </FormField>
  )
}
