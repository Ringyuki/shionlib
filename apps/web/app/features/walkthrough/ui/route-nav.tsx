import { Flex, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { conditioned, portraitsIn, type Face, type Route } from '../walkthrough'
import { entryRow, RouteEntry } from './route-entry'

type RouteNavProps = {
  routes: readonly Route[]
  faces: readonly Face[]
  index: number
  hrefOf: (index: number) => string
  roomy?: boolean
  onPick?: () => void
}

export function RouteNav({ routes, faces, index, hrefOf, roomy = false, onPick }: RouteNavProps) {
  const t = useTranslations('walkthrough')
  const locks = routes.some(route => conditioned(route))
  return (
    <Stack as="nav" gap="none" aria-label={t('routes')} className="gap-0.5">
      {routes.map((route, at) => (
        <Flex
          key={route.key}
          as={InPageLink}
          href={hrefOf(at)}
          aria-current={at === index ? 'true' : undefined}
          onClick={onPick}
          className={entryRow(at === index, roomy ? 'min-h-12 py-2.5' : 'min-h-11 py-2.5')}
        >
          <RouteEntry
            ordinal={at + 1}
            name={route.name}
            portraits={portraitsIn(route, faces)}
            active={at === index}
            conditioned={conditioned(route)}
            locks={locks}
            roomy={roomy}
          />
        </Flex>
      ))}
    </Stack>
  )
}
