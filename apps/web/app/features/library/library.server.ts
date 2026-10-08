import { redirect, type LoaderFunctionArgs } from 'react-router'
import { pageParam } from '~/shared/route/params'
import { routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { lastPage, librarySearch, yearOptions } from './library'
import { addressFrom, legacyParams } from './library.schema'
import { loadLibrary, searchTags } from './library.use-cases'

export async function libraryLoader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url)
  const years = yearOptions(new Date())
  const read = (params: URLSearchParams) =>
    addressFrom(params, pageParam(params.get('page')), years)
  const legacy = legacyParams(url.searchParams)
  if (legacy !== undefined) {
    throw redirect(`${url.pathname}${librarySearch(read(legacy))}`, 301)
  }
  const address = read(url.searchParams)
  const content = await routeLoader(args, api => loadLibrary(api, address, years))
  const last = lastPage(content.total)
  if (address.page > last) {
    throw redirect(`${url.pathname}${librarySearch({ ...address, page: last })}`)
  }
  return content
}

export function tagOptionsLoader(args: LoaderFunctionArgs) {
  const query = new URL(args.request.url).searchParams.get('q') ?? ''
  return routeLazyLoader(args, api => searchTags(api, query))
}
