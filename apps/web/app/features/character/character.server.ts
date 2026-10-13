import type { LoaderFunctionArgs } from 'react-router'
import { worksPageSize } from '~/features/game'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { loadCharacter } from './character.use-cases'

export async function characterLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const page = requestedPage(args.url)
  const content = await routeLoader(args, api => loadCharacter(api, id, page))
  keepWithinPages(args.url, content.works.total, worksPageSize)
  return content
}
