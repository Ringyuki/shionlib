import { WritingPage } from '~/features/walkthrough'
import type { Route } from './+types/walkthrough.write'

export { writingLoader as loader } from '~/features/walkthrough/walkthrough.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.walkthrough.writeTitle} | Shionlib` }]
}

export default function WalkthroughWriteRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <WritingPage writing={loaderData} signedIn={site.loaderData.viewer !== null} />
}
