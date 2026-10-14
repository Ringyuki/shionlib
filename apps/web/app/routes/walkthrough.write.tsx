import { WritingPage } from '~/features/walkthrough'
import type { Route } from './+types/walkthrough.write'
import { pageMeta } from '~/shared/seo/seo'

export { writingLoader as loader } from '~/features/walkthrough/walkthrough.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, {
    title: lang.loaderData.messages.walkthrough.writeTitle,
    indexable: false,
  })
}

export default function WalkthroughWriteRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <WritingPage writing={loaderData} signedIn={site.loaderData.viewer !== null} />
}
