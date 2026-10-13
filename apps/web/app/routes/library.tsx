import { LibraryPage } from '~/features/library'
import type { Route } from './+types/library'

export { libraryLoader as loader } from '~/features/library/library.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.library.title} | Shionlib` }]
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
