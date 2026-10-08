import { describe, expect, it } from 'vitest'
import {
  firstOrder,
  orderOf,
  orderParams,
  orderQuery,
  reversible,
  searchInOrder,
  workOrders,
} from './game-order'
import { orderFrom } from './game.schema'

describe('orderOf', () => {
  it('names an order', () => {
    expect(orderOf(firstOrder).name).toBe('newest')
    expect(orderOf({ sort: 'release_date', ascending: true }).name).toBe('oldest')
    expect(orderOf({ sort: 'resource_updated', ascending: false }).name).toBe('updated')
  })

  it('falls back on the only direction a sort has', () => {
    expect(reversible('views')).toBe(false)
    expect(orderOf({ sort: 'views', ascending: true }).name).toBe('views')
  })
})

describe('the order in an address', () => {
  it('leaves the first order out and names the others', () => {
    expect(orderParams(new URLSearchParams('sort=views&order=asc'), firstOrder).toString()).toBe('')
    expect(
      orderParams(new URLSearchParams(), { sort: 'release_date', ascending: true }).toString(),
    ).toBe('order=asc')
    expect(
      orderParams(new URLSearchParams(), { sort: 'downloads', ascending: true }).toString(),
    ).toBe('sort=downloads')
  })

  it('goes back to the first page when the order changes', () => {
    expect(searchInOrder('?page=3&sort=downloads', { sort: 'hot_score', ascending: false })).toBe(
      '?sort=hot_score',
    )
    expect(searchInOrder('?page=3', firstOrder)).toBe('')
  })

  it('reads an order and ignores what it cannot use', () => {
    expect(orderFrom(new URLSearchParams('sort=hot_score'))).toEqual({
      sort: 'hot_score',
      ascending: false,
    })
    expect(orderFrom(new URLSearchParams('order=asc'))).toEqual({
      sort: 'release_date',
      ascending: true,
    })
    expect(orderFrom(new URLSearchParams('sort=views&order=asc'))).toEqual({
      sort: 'views',
      ascending: false,
    })
    expect(orderFrom(new URLSearchParams('sort=price'))).toEqual(firstOrder)
  })
})

describe('orders of works', () => {
  it('offers the orders that list every game', () => {
    expect(workOrders.map(order => order.name)).toEqual(['newest', 'oldest', 'hot', 'downloads'])
  })

  it('asks the API for the order', () => {
    expect(orderQuery({ sort: 'downloads', ascending: false })).toEqual({
      'filter[sort_by]': 'downloads',
      'filter[sort_order]': 'desc',
    })
  })
})
