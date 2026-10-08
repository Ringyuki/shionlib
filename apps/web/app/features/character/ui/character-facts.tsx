import { DescriptionDetails, DescriptionList, DescriptionTerm, Inline, Text } from '@hina-ui/react'
import { Fragment } from 'react'
import { useFormatter, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { birthdayOf, gendersOf, measurementsOf, type CharacterDetail } from '../character'

const factListClass =
  'grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2 [&>dd]:m-0! [&>dt]:m-0!'

export function CharacterFacts({ character }: { character: CharacterDetail }) {
  const t = useTranslations('character.fact')
  const labels = useMessages().character
  const format = useFormatter()
  const aliases = character.aliases ?? []
  const genders = gendersOf(character)
  const birthday = birthdayOf(character)
  const sizes = measurementsOf(character)
  const facts = [
    ['aliases', aliases.length === 0 ? undefined : format.list(aliases)],
    [
      'gender',
      genders.length === 0
        ? undefined
        : format.list(genders.map(gender => labelOf(labels.gender, gender))),
    ],
    ['age', character.age === null ? undefined : t('ageValue', { age: character.age })],
    [
      'birthday',
      birthday === undefined
        ? undefined
        : format.dateTime(birthday, { month: 'long', day: 'numeric', timeZone: 'UTC' }),
    ],
    [
      'bloodType',
      character.blood_type === null
        ? undefined
        : t('bloodTypeValue', { type: character.blood_type.toUpperCase() }),
    ],
    [
      'height',
      character.height === null ? undefined : t('heightValue', { value: character.height }),
    ],
    [
      'weight',
      character.weight === null ? undefined : t('weightValue', { value: character.weight }),
    ],
    [
      'measurements',
      sizes.length === 0 ? undefined : (
        <Inline gap="md">
          {sizes.map(({ part, size }) => (
            <Text key={part} as="span" className="tabular-nums">
              {part} {size}
            </Text>
          ))}
        </Inline>
      ),
    ],
    ['cup', character.cup?.trim() || undefined],
  ] as const
  const known = facts.filter(([, value]) => value !== undefined)
  if (known.length === 0) {
    return null
  }
  return (
    <DescriptionList className={factListClass}>
      {known.map(([name, value]) => (
        <Fragment key={name}>
          <DescriptionTerm>{t(name)}</DescriptionTerm>
          <DescriptionDetails>{value}</DescriptionDetails>
        </Fragment>
      ))}
    </DescriptionList>
  )
}
