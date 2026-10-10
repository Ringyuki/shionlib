import { cn, Flex, Heading, Inline, Link, Stack, Text } from '@hina-ui/react'
import { Lock } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { requiredBy, rowsOf, saveAnchor, type Linked, type Route } from '../walkthrough'
import { StepRows } from './step-rows'

type RoutePartProps = {
  routes: readonly Route[]
  index: number
  switched: boolean
  hrefOf: (index: number) => string
}

export function RoutePart({ routes, index, switched, hrefOf }: RoutePartProps) {
  const t = useTranslations('walkthrough')
  const route = routes[index]
  if (route === undefined) {
    return null
  }
  const partHref = (linked: Linked) => hrefOf(linked.ordinal - 1)
  return (
    <Stack gap="sm">
      <Stack gap="xs">
        <Heading
          level={2}
          size="md"
          className={cn('flex min-h-11 items-center', switched && 'max-lg:sr-only')}
        >
          {route.name === '' ? t('unnamed') : route.name}
        </Heading>
        <Condition
          required={requiredBy(routes, index)}
          condition={route.condition}
          partHref={partHref}
        />
      </Stack>
      <StepRows
        rows={rowsOf(routes, index)}
        sourceHref={(source, slot) => `${partHref(source)}#${saveAnchor(slot)}`}
      />
    </Stack>
  )
}

type ConditionProps = {
  required: readonly Linked[]
  condition: string
  partHref: (linked: Linked) => string
}

function Condition({ required, condition, partHref }: ConditionProps) {
  const t = useTranslations('walkthrough')
  if (required.length === 0 && condition === '') {
    return null
  }
  return (
    <Inline gap="sm" align="start" wrap={false} className="text-muted">
      <Flex
        as="span"
        role="img"
        aria-label={t('conditioned')}
        className="h-5.5 shrink-0 items-center"
      >
        <Lock className="size-4" />
      </Flex>
      <Stack gap="none" className="min-w-0">
        {required.length > 0 && (
          <Text as="span" size="sm" className="text-inherit">
            {t.rich('requires', {
              routes: () =>
                required.map((linked, at) => (
                  <Fragment key={linked.ordinal}>
                    {at > 0 && t('nameSeparator')}
                    <Link asChild>
                      <InPageLink href={partHref(linked)}>
                        {linked.name === '' ? t('unnamed') : linked.name}
                      </InPageLink>
                    </Link>
                  </Fragment>
                )),
            })}
          </Text>
        )}
        {condition !== '' && (
          <Text as="span" size="sm" className="text-inherit">
            {condition}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
