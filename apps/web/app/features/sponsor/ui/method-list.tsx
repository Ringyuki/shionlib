import { Empty, Grid, Heading, Inline, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { captionOf, type Method } from '../sponsor'
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
    <Stack as="section" gap="md" aria-labelledby="sponsor-methods">
      <Heading id="sponsor-methods" level={2} size="md">
        {t('methods')}
      </Heading>
      {methods.length === 0 ? (
        <Empty title={t('none')} size="sm" />
      ) : (
        <Grid role="group" aria-labelledby="sponsor-methods" className="gap-3 sm:grid-cols-2">
          {methods.map(({ method, name }) => (
            <ChoiceCard
              key={method}
              chosen={method === value}
              onChoose={() => onValueChange(method)}
              className="px-4 py-3"
            >
              <Inline as="span" gap="md" align="center" wrap={false}>
                <MethodMark method={method} />
                <Stack as="span" gap="none" className="min-w-0">
                  <Text as="span" weight="medium">
                    {nameOf(method, name)}
                  </Text>
                  {captionOf(method) !== undefined && (
                    <Text as="span" size="xs" tone="muted">
                      {captionOf(method)}
                    </Text>
                  )}
                </Stack>
              </Inline>
            </ChoiceCard>
          ))}
        </Grid>
      )}
    </Stack>
  )
}
