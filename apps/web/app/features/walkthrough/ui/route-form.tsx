import { cn, Form, FormField, Grid, Input, Stack, Text, type FormHandle } from '@hina-ui/react'
import { Trash2 } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { Button } from '~/shared/ui/button'
import { flushEnd } from '~/shared/ui/flush'
import type { Flagged } from '../use-walkthrough-writing'
import type { Route } from '../walkthrough'
import { cast, named, type Naming, type RouteDraft } from '../walkthrough-draft'
import type { StepWords } from '../walkthrough-steps'
import { CharacterField } from './character-field'
import { ConditionFields } from './condition-fields'
import { OptionalLabel } from './optional-label'
import { StepsField } from './steps-field'
import { StepsPreview } from './steps-preview'

type RouteFormProps = {
  route: RouteDraft
  others: readonly RouteDraft[]
  written: readonly Route[]
  index: number
  naming: Naming
  words: StepWords
  saves: readonly string[]
  flagged: Flagged | undefined
  previewing: boolean
  onChange: (change: (route: RouteDraft) => RouteDraft) => void
  onRemove: () => void
}

export function RouteForm(props: RouteFormProps) {
  const { route, others, written, index, naming, words, saves, flagged, previewing } = props
  const { onChange, onRemove } = props
  const t = useTranslations('walkthrough')
  const form = useRef<FormHandle>(null)
  const condition = useId()
  useEffect(() => {
    if (flagged?.key === route.key) {
      form.current?.setErrors(flagged.errors)
    }
  }, [flagged, route.key])
  const set = (fields: Partial<RouteDraft>) => onChange(current => ({ ...current, ...fields }))
  return (
    <Form ref={form} values={route} className="grid gap-5 md:grid-cols-2">
      <CharacterField
        value={route.characters}
        faces={naming.faces}
        className="max-md:order-3"
        onValueChange={characters => onChange(current => cast(current, characters, naming))}
      />
      <FormField name="name" label={t('routeName')} className="max-md:order-1">
        <Input
          value={route.name}
          maxLength={lengthOf('WalkthroughRouteInput', 'name').max}
          onValueChange={name => onChange(current => named(current, name))}
        />
      </FormField>
      <Stack
        role="group"
        aria-labelledby={condition}
        gap="none"
        className="gap-1.5 max-md:order-4 md:col-span-2"
      >
        <Text as="span" id={condition} size="sm" weight="medium">
          <OptionalLabel>{t('condition')}</OptionalLabel>
        </Text>
        <Grid gap="none" className="gap-5 md:grid-cols-2">
          <ConditionFields route={route} others={others} onChange={set} />
        </Grid>
      </Stack>
      <StepsField
        value={route.steps}
        words={words}
        saves={saves}
        className={previewing ? 'max-md:hidden' : 'max-md:order-2'}
        onValueChange={steps => set({ steps })}
      />
      <StepsPreview
        routes={written}
        index={index}
        className={previewing ? 'max-md:order-2' : 'max-md:hidden'}
      />
      <FormField
        name="ending"
        label={<OptionalLabel>{t('ending')}</OptionalLabel>}
        className="max-md:order-5"
      >
        <Input
          value={route.ending}
          maxLength={lengthOf('WalkthroughRouteInput', 'ending').max}
          onValueChange={ending => set({ ending })}
        />
      </FormField>
      <Button
        variant="ghost"
        tone="danger"
        icon={<Trash2 />}
        className={cn('place-self-end text-sm max-md:order-6', flushEnd.md)}
        onClick={onRemove}
      >
        {t('removeRoute')}
      </Button>
    </Form>
  )
}
