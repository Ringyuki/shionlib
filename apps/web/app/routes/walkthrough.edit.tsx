import { WalkthroughEditorPage } from '~/features/walkthrough'
import type { Route } from './+types/walkthrough.edit'

export { editorLoader as loader } from '~/features/walkthrough/walkthrough.server'

export function meta({ matches, loaderData }: Route.MetaArgs) {
  const [, lang] = matches
  const { editTitle, writeTitle } = lang.loaderData.messages.walkthrough
  const title = loaderData?.walkthroughId === undefined ? writeTitle : editTitle
  return [{ title: `${title} | Shionlib` }]
}

export default function WalkthroughEditRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <WalkthroughEditorPage
      key={loaderData.walkthroughId ?? 'new'}
      draft={loaderData}
      signedIn={site.loaderData.viewer !== null}
    />
  )
}
