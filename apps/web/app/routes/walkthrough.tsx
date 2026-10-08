import { WalkthroughPage } from '~/features/walkthrough'
import type { Route } from './+types/walkthrough'

export { readingLoader as loader } from '~/features/walkthrough/walkthrough.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.walkthrough.title} | Shionlib` }]
}

export default function WalkthroughRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <WalkthroughPage
      reading={loaderData}
      own={site.loaderData.viewer?.id === loaderData.walkthrough.creator.id}
    />
  )
}
