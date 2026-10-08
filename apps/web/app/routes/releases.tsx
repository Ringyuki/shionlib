import { ReleasesPage } from '~/features/release'
import type { Route } from './+types/releases'

export { releasesLoader as loader } from '~/features/release/release.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.release.title} | Shionlib` }]
}

export default function ReleasesRoute({ loaderData }: Route.ComponentProps) {
  return <ReleasesPage releases={loaderData} />
}
