import { WallPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor'

export { wallLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.sponsor.title} | Shionlib` }]
}

export default function SponsorRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <WallPage wall={loaderData} viewer={site.loaderData.viewer} />
}
