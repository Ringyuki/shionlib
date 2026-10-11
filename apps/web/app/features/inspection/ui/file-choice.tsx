import { Inline, Select, Text } from '@hina-ui/react'
import { useId } from 'react'
import { useTranslations } from 'use-intl'
import { namesOf, type InspectedFile, type Inspection } from '../inspection'

type FileChoiceProps = {
  inspections: readonly Inspection[]
  files: readonly InspectedFile[]
  chosen: number
  onChoose: (inspectionId: number) => void
}

export function FileChoice({ inspections, files, chosen, onChoose }: FileChoiceProps) {
  const t = useTranslations('inspection.contents')
  const label = useId()
  const options = inspections.map(inspection => {
    const [first = '', ...others] = namesOf(files, inspection.id)
    return {
      value: inspection.id,
      label: others.length === 0 ? first : t('volumes', { name: first, count: others.length + 1 }),
    }
  })
  return (
    <Inline gap="md" align="center" wrap={false}>
      <Text as="span" id={label} tone="muted" className="shrink-0">
        {t('file')}
      </Text>
      <Select
        aria-labelledby={label}
        value={chosen}
        onValueChange={value => {
          if (typeof value === 'number') {
            onChoose(value)
          }
        }}
        options={options}
        className="min-w-0 flex-1 sm:max-w-xl"
      />
    </Inline>
  )
}
