import type { ApiQuery } from '~/shared/api/types'
import { pageKey } from '~/shared/http/paging'
import type { GameSort } from './game'

export type GameOrder = { sort: GameSort; ascending: boolean }

export const sortKeys = [
  'release_date',
  'resource_updated',
  'hot_score',
  'views',
  'downloads',
] as const satisfies readonly GameSort[]

export const orders = [
  { name: 'newest', sort: 'release_date', ascending: false },
  { name: 'oldest', sort: 'release_date', ascending: true },
  { name: 'updated', sort: 'resource_updated', ascending: false },
  { name: 'hot', sort: 'hot_score', ascending: false },
  { name: 'views', sort: 'views', ascending: false },
  { name: 'downloads', sort: 'downloads', ascending: false },
] as const satisfies readonly (GameOrder & { name: string })[]

export type Order = (typeof orders)[number]

export const firstOrder: GameOrder = { sort: 'release_date', ascending: false }

export const workOrders: readonly Order[] = orders.filter(
  order => order.sort !== 'resource_updated' && order.sort !== 'views',
)

export function reversible(sort: GameSort): boolean {
  return orders.some(order => order.sort === sort && order.ascending)
}

export function orderOf(order: GameOrder): Order {
  const sorted = orders.filter(candidate => candidate.sort === order.sort)
  return sorted.find(candidate => candidate.ascending === order.ascending) ?? sorted[0] ?? orders[0]
}

export function orderParams(params: URLSearchParams, order: GameOrder): URLSearchParams {
  params.delete('sort')
  params.delete('order')
  if (order.sort !== firstOrder.sort) {
    params.set('sort', order.sort)
  }
  if (order.ascending && reversible(order.sort)) {
    params.set('order', 'asc')
  }
  return params
}

export function searchInOrder(search: string, order: GameOrder): string {
  const params = orderParams(new URLSearchParams(search), order)
  params.delete(pageKey)
  const kept = params.toString()
  return kept === '' ? '' : `?${kept}`
}

export function orderQuery(
  order: GameOrder,
): Pick<ApiQuery<'/game/list', 'get'>, 'filter[sort_by]' | 'filter[sort_order]'> {
  return { 'filter[sort_by]': order.sort, 'filter[sort_order]': order.ascending ? 'asc' : 'desc' }
}
