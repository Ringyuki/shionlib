import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { filterFrom, translatorCommand } from './admin-translator.schema'
import { changeTranslator, loadTranslators } from './admin-translator.use-cases'

export async function translatorsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadTranslators(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function translatorAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, translatorCommand)
  return routeAction(args, api => changeTranslator(api, change))
}
