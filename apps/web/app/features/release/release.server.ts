import type { LoaderFunctionArgs } from 'react-router'
import { resourceRuleFrom } from '~/features/game'
import { routeLoader } from '~/shared/route/route.server'
import { monthFrom } from './release.schema'
import { loadReleases } from './release.use-cases'

export function releasesLoader(args: LoaderFunctionArgs) {
  const params = args.url.searchParams
  const now = new Date()
  const month = monthFrom(params.get('month'), now)
  const resources = resourceRuleFrom(params.get('resources'))
  return routeLoader(args, api => loadReleases(api, month, resources, now))
}
