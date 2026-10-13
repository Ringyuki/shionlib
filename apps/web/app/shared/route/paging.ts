import { redirect } from 'react-router'
import { lastPage, pageKey, searchAtPage } from '~/shared/http/paging'
import { pageParam } from './params'

export function requestedPage(url: URL): number {
  return pageParam(url.searchParams.get(pageKey))
}

export function keepWithinPages(url: URL, total: number, pageSize: number): void {
  const last = lastPage(total, pageSize)
  if (pageParam(url.searchParams.get(pageKey)) > last) {
    throw redirect(`${url.pathname}${searchAtPage(url.search, last)}`)
  }
}
