import { Chip, Inline } from '@hina-ui/react'
import type { ReactNode } from 'react'

type ChoiceChipsProps<T extends string> = {
  label: string
  options: readonly T[]
  value: readonly T[]
  onValueChange: (value: T[]) => void
  labelOf: (option: T) => string
  iconOf?: (option: T) => ReactNode
}

type SingleChoiceChipsProps<T extends string> = Omit<
  ChoiceChipsProps<T>,
  'value' | 'onValueChange'
> & {
  value: T | ''
  onValueChange: (value: T | '') => void
}

export function SingleChoiceChips<T extends string>({
  value,
  onValueChange,
  ...choices
}: SingleChoiceChipsProps<T>) {
  return (
    <ChoiceChips
      {...choices}
      value={value === '' ? [] : [value]}
      onValueChange={picked => onValueChange(picked.find(option => option !== value) ?? '')}
    />
  )
}

export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onValueChange,
  labelOf,
  iconOf,
}: ChoiceChipsProps<T>) {
  const toggle = (option: T, selected: boolean) =>
    onValueChange(
      options.filter(candidate => (candidate === option ? selected : value.includes(candidate))),
    )
  return (
    <Inline gap="xs" role="group" aria-label={label}>
      {options.map(option => (
        <Chip
          key={option}
          selectable
          selected={value.includes(option)}
          onSelectedChange={selected => toggle(option, selected)}
          icon={iconOf?.(option)}
        >
          {labelOf(option)}
        </Chip>
      ))}
    </Inline>
  )
}
