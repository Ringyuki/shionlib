import { ResourceDetails } from '~/features/resource'
import type { Route } from './+types/resource.details'

export default function ResourceDetailsRoute({ matches }: Route.ComponentProps) {
  const [, , , , resource] = matches
  return <ResourceDetails resource={resource.loaderData.resource} />
}
