import { CharacterPage, characterName } from '~/features/character'
import { isLocale } from '~/shared/i18n/locale.schema'
import type { Route } from './+types/character'

export { characterLoader as loader } from '~/features/character/character.server'

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (loaderData === undefined || !isLocale(params.lang)) {
    return []
  }
  return [{ title: `${characterName(loaderData.character, params.lang)} | Shionlib` }]
}

export default function CharacterRoute({ loaderData }: Route.ComponentProps) {
  return <CharacterPage content={loaderData} />
}
