import { describe, expect, it } from 'vitest'
import {
  ascending,
  clusterKey,
  idsOf,
  keptByDefault,
  mergedInto,
  searchOf,
  type Translator,
} from './admin-translator'

const translator = (id: number, name: string, resources: number): Translator => ({
  id,
  name,
  aliases: [],
  homepage: null,
  works_count: resources,
  resources_count: resources,
  latest_credit: null,
})

const cluster = [
  translator(4, 'Can/need', 1),
  translator(2, 'Can/need汉化组', 3),
  translator(9, 'Can／need汉化组', 3),
]

describe('searchOf', () => {
  it('writes only what differs from the first view of the list', () => {
    expect(searchOf({ view: 'all', query: '', sort: 'works' })).toBe('')
    expect(searchOf({ view: 'duplicates', query: '', sort: 'works' })).toBe('?view=duplicates')
    expect(searchOf({ view: 'all', query: '绿茶', sort: 'name' })).toBe(
      '?q=%E7%BB%BF%E8%8C%B6&sort=name',
    )
  })
})

describe('ascending', () => {
  it('orders names from the first and everything else from the most', () => {
    expect(ascending('name')).toBe(true)
    expect(ascending('works')).toBe(false)
    expect(ascending('latest')).toBe(false)
  })
})

describe('clusters', () => {
  it('keeps the name with the most resources unless another is chosen', () => {
    expect(keptByDefault(cluster)).toBe(2)
    expect(keptByDefault([])).toBeNull()
  })

  it('merges every other translator of the cluster into the kept one', () => {
    expect(mergedInto(cluster, 2)).toEqual([4, 9])
    expect(idsOf(cluster)).toEqual([4, 2, 9])
    expect(clusterKey(cluster)).toBe('4-2-9')
  })
})
