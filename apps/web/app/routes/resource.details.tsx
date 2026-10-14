import { ResourceDetails, resourceHead } from '~/features/resource'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/resource.details'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , resource] = args.matches
  return pageMeta(args, resourceHead(resource.loaderData, lang.loaderData, 'details'))
}

export default function ResourceDetailsRoute({ matches }: Route.ComponentProps) {
  const [, , , , resource] = matches
  const { resource: shown, inspections, lineage } = resource.loaderData
  return <ResourceDetails resource={shown} inspections={inspections} origin={lineage.latest} />
}
