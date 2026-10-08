import { redirect } from 'react-router'
import { lastPage, pageKey, searchAtPage } from '~/shared/http/paging'
import { pageParam } from './params'

export function requestedPage(request: Request): number {
  return pageParam(new URL(request.url).searchParams.get(pageKey))
}

export function keepWithinPages(request: Request, total: number, pageSize: number): void {
  const url = new URL(request.url)
  const last = lastPage(total, pageSize)
  if (pageParam(url.searchParams.get(pageKey)) > last) {
    throw redirect(`${url.pathname}${searchAtPage(url.search, last)}`)
  }
}
