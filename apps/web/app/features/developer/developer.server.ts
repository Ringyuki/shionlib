import type { LoaderFunctionArgs } from 'react-router'
import { orderFrom, worksPageSize } from '~/features/game'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { normalizedQuery, pageSize } from './developer'
import { loadDeveloper, loadDevelopers } from './developer.use-cases'

export async function developersLoader(args: LoaderFunctionArgs) {
  const query = normalizedQuery(new URL(args.request.url).searchParams.get('q'))
  const page = requestedPage(args.request)
  const developers = await routeLoader(args, api => loadDevelopers(api, query, page))
  keepWithinPages(args.request, developers.total, pageSize)
  return developers
}

export async function developerLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const page = requestedPage(args.request)
  const order = orderFrom(new URL(args.request.url).searchParams)
  const content = await routeLoader(args, api => loadDeveloper(api, id, page, order))
  keepWithinPages(args.request, content.works.total, worksPageSize)
  return content
}
