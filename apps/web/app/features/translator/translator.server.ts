import type { LoaderFunctionArgs } from 'react-router'
import { orderFrom, worksPageSize } from '~/features/game'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { cleanName, maxNameLength, normalizedQuery, pageSize } from './translator'
import { loadTranslator, loadTranslators, suggestTranslators } from './translator.use-cases'

export async function translatorsLoader(args: LoaderFunctionArgs) {
  const query = normalizedQuery(args.url.searchParams.get('q'))
  const page = requestedPage(args.url)
  const translators = await routeLoader(args, api => loadTranslators(api, query, page))
  keepWithinPages(args.url, translators.total, pageSize)
  return translators
}

export async function translatorLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const page = requestedPage(args.url)
  const order = orderFrom(args.url.searchParams)
  const content = await routeLoader(args, api => loadTranslator(api, id, page, order))
  keepWithinPages(args.url, content.works.total, worksPageSize)
  return content
}

export function translatorOptionsLoader(args: LoaderFunctionArgs) {
  const typed = cleanName(args.url.searchParams.get('q') ?? '')
  const query = [...typed].slice(0, maxNameLength).join('')
  return routeLazyLoader(args, api => suggestTranslators(api, query))
}
