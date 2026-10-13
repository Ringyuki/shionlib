import { Empty, Grid, Heading, Inline, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { captionOf, feeOf, type Method } from '../sponsor'
import { useMethodName } from '../use-sponsor-format'
import { ChoiceCard } from './choice-card'
import { MethodMark } from './method-mark'

type MethodListProps = {
  methods: Method[]
  value: string | undefined
  onValueChange: (method: string) => void
}

export function MethodList({ methods, value, onValueChange }: MethodListProps) {
  const t = useTranslations('sponsor.pay')
  const nameOf = useMethodName()
  return (
    <Stack as="section" gap="md" aria-labelledby="sponsor-methods" className="@container">
      <Heading id="sponsor-methods" level={2} size="md">
        {t('methods')}
      </Heading>
      {methods.length === 0 ? (
        <Empty title={t('none')} size="sm" />
      ) : (
        <Grid role="group" aria-labelledby="sponsor-methods" className="gap-3 @xl:grid-cols-2">
          {methods.map(method => (
            <ChoiceCard
              key={method.id}
              chosen={method.id === value}
              onChoose={() => onValueChange(method.id)}
              className="min-h-16.5 px-4 py-2.5"
            >
              <Inline as="span" gap="md" align="center" wrap={false}>
                <MethodMark method={method} />
                <Stack as="span" gap="none" className="min-w-0 flex-1">
                  <Text as="span" weight="medium">
                    {nameOf(method)}
                  </Text>
                  {captionOf(method) !== undefined && (
                    <Text as="span" size="xs" tone="muted">
                      {captionOf(method)}
                    </Text>
                  )}
                </Stack>
                {feeOf(method) !== undefined && (
                  <Text as="span" size="xs" tone="muted" className="shrink-0 tabular-nums">
                    {t('fee', { fee: feeOf(method) ?? '' })}
                  </Text>
                )}
              </Inline>
            </ChoiceCard>
          ))}
        </Grid>
      )}
    </Stack>
  )
}
