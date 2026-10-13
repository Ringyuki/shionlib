import { DeveloperPage } from '~/features/developer'
import type { Route } from './+types/developer'

export { developerLoader as loader } from '~/features/developer/developer.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.developer.name} | Shionlib` }]
}

export default function DeveloperRoute({ loaderData }: Route.ComponentProps) {
  return <DeveloperPage content={loaderData} />
}
