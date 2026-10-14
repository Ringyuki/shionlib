import { LibraryPage } from '~/features/library'
import type { Route } from './+types/library'
import { pageMeta } from '~/shared/seo/seo'

export { libraryLoader as loader } from '~/features/library/library.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.library.title })
}

export default function Library({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <LibraryPage
      content={loaderData}
      filtered={site.loaderData.viewer?.only_games_with_resources ?? true}
    />
  )
}
