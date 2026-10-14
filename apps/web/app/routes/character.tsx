import { CharacterPage, characterHead } from '~/features/character'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/character'

export { characterLoader as loader } from '~/features/character/character.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && characterHead(args.loaderData, lang.loaderData))
}

export default function CharacterRoute({ loaderData }: Route.ComponentProps) {
  return <CharacterPage content={loaderData} />
}
