import { ResourceDetails } from '~/features/resource'
import type { Route } from './+types/resource.details'

export default function ResourceDetailsRoute({ matches }: Route.ComponentProps) {
  const [, , , , resource] = matches
  const { resource: shown, inspections, lineage } = resource.loaderData
  return <ResourceDetails resource={shown} inspections={inspections} origin={lineage.latest} />
}
