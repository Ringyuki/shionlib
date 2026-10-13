import { Select, Stack, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { protocolName, protocolNames, protocols as known } from '~/features/admin-ai'
import { protocolsFor, routeName, type Route } from '../admin-ai-route'
import { useRouteChange } from '../use-route-change'
import { RouteAdjustments } from './route-adjustments'

type RouteProtocolProps = {
  route: Route
  protocols?: readonly string[] | null
  editable?: boolean
}

export function RouteProtocol({ route, protocols, editable = false }: RouteProtocolProps) {
  const t = useTranslations('adminAiRoute')
  const change = useRouteChange()
  const offered = protocolsFor(protocols, route.model.moderation)
  const choices = offered.includes(route.protocol) ? offered : [route.protocol, ...offered]
  const submitted =
    change.submitted?.action === 'update' ? change.submitted.changes.protocol : undefined
  return (
    <Stack gap="xs" className="min-w-0">
      {protocols === undefined ? (
        <Text as="span" size="sm">
          {protocolName(route.protocol)}
        </Text>
      ) : (
        <Select
          size="sm"
          className="w-44"
          aria-label={t('protocolOf', { route: routeName(route) })}
          disabled={!editable || change.pending || choices.length < 2}
          value={change.pending && submitted !== undefined ? submitted : route.protocol}
          options={choices.map(protocol => ({ value: protocol, label: protocolNames[protocol] }))}
          onValueChange={async value => {
            const protocol = known.find(candidate => candidate === value)
            if (protocol === undefined || protocol === route.protocol) {
              return
            }
            const outcome = await change.run({
              action: 'update',
              id: route.id,
              changes: { protocol },
            })
            if (outcome.ok) {
              toast.success(t('protocolChanged', { protocol: protocolNames[protocol] }))
            }
          }}
        />
      )}
      <RouteAdjustments route={route} />
    </Stack>
  )
}
