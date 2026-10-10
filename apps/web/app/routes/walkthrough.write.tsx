import { WalkthroughWritingPage } from '~/features/walkthrough'
import { canvasFrame } from '~/shared/route/frame'
import type { Route } from './+types/walkthrough.write'

export { writingLoader as loader } from '~/features/walkthrough/walkthrough.server'

export const handle = canvasFrame

export function meta({ matches, loaderData }: Route.MetaArgs) {
  const [, lang] = matches
  const { editTitle, writeTitle } = lang.loaderData.messages.walkthrough
  const title = loaderData?.walkthroughId === undefined ? writeTitle : editTitle
  return [{ title: `${title} | Shionlib` }]
}

export default function WalkthroughWriteRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <WalkthroughWritingPage draft={loaderData} signedIn={site.loaderData.viewer !== null} />
}
