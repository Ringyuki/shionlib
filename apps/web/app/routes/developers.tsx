import { DevelopersPage } from '~/features/developer'
import type { Route } from './+types/developers'

export { developersLoader as loader } from '~/features/developer/developer.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.developer.title} | Shionlib` }]
}

export default function DevelopersRoute({ loaderData }: Route.ComponentProps) {
  return <DevelopersPage developers={loaderData} />
}
