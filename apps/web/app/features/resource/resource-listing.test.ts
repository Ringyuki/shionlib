import { describe, expect, it } from 'vitest'
import type { Resource } from './resource'
import {
  filterCount,
  filterGroups,
  listOf,
  noFilter,
  offered,
  pick,
  type ListFilter,
  type MoyuEntry,
} from './resource-listing'

const file = (size: number): NonNullable<Resource['files']>[number] => ({
  id: size,
  type: 1,
  file_name: 'game.7z',
  original_name: null,
  canonical_name: false,
  file_size: size,
  file_url: null,
  s3_file_key: null,
  hash_algorithm: 'blake3',
  file_hash: 'a'.repeat(64),
  file_status: 3,
  stage: 'stored',
  rejection: null,
  is_virus_false_positive: false,
  malware_scan_cases: null,
  creator: { id: 7, name: 'mikan', avatar: null, is_sponsor: false },
  latest_history: null,
  uploaded: '2026-01-01T00:00:00Z',
  sha256: null,
  inspection_id: null,
})

const resource = (
  id: number,
  facts: Partial<Resource> = {},
  sizes: number[] = [100],
): Resource => ({
  id,
  platform: ['win'],
  language: ['jp'],
  simulator: null,
  downloads: 0,
  creator: { id: 7, name: 'mikan', avatar: null, is_sponsor: false },
  published_at: '2026-01-01T00:00:00Z',
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
  comments: 0,
  files: sizes.map(file),
  missing_volumes: [],
  volumes_deadline: null,
  translation: null,
  translators: [],
  patch_version: null,
  release_url: null,
  edition: null,
  edition_name: null,
  form: null,
  extras: [],
  canonical_name: false,
  ...facts,
})

const entry = (id: string, facts: Partial<MoyuEntry> = {}): MoyuEntry => ({
  id,
  kind: 'patch',
  name: `patch ${id}`,
  size: 10,
  language: ['zh'],
  platform: ['win'],
  translation: 'machine',
  translator: null,
  model: null,
  downloads: 0,
  url: `https://www.moyu.moe/resource/${id}`,
  updated: '2026-01-01T00:00:00Z',
  publisher: null,
  ...facts,
})

const only = (filter: Partial<ListFilter>): ListFilter => ({ ...noFilter, ...filter })

const keys = (items: readonly { key: string }[]) => items.map(item => item.key)

describe('listOf', () => {
  it('puts what the site holds and what the other site lists into one list', () => {
    const [site, moyu, bare] = listOf(
      [resource(1, { translation: 'group', language: ['zh', 'jp'], downloads: 3 }, [100, 50])],
      [entry('a', { kind: 'save', translation: null, size: null }), entry('b', { language: null })],
    )
    expect(site).toMatchObject({
      key: 'site-1',
      kind: ['game'],
      language: ['zh', 'jp'],
      translation: ['group'],
      platform: ['win'],
      downloads: 3,
      size: 150,
    })
    expect(moyu).toMatchObject({ key: 'moyu-a', kind: ['save'], translation: [], size: undefined })
    expect(bare).toMatchObject({ language: [], translation: ['machine'], size: 10 })
  })

  it('takes a resource in Japanese only, or without a word on it, as not translated', () => {
    const [none, unknown, empty] = listOf(
      [resource(1, { translation: 'none' }), resource(2), resource(3, {}, [])],
      [],
    )
    expect(none?.translation).toEqual([])
    expect(unknown?.translation).toEqual([])
    expect(empty?.size).toBeUndefined()
  })
})

describe('filterGroups', () => {
  it('offers what the list holds, in a fixed order, and leaves out a group with one value', () => {
    const items = listOf(
      [resource(1, { language: ['jp'] }), resource(2, { language: ['en', 'zh'] })],
      [entry('a', { kind: 'save', translation: null }), entry('b', { language: ['zh-hant'] })],
    )
    expect(filterGroups(items)).toEqual([
      { name: 'kind', options: ['game', 'patch', 'save'] },
      { name: 'language', options: ['zh', 'zh-hant', 'en', 'jp'] },
    ])
  })

  it('offers nothing for a list of one kind that agrees on everything', () => {
    expect(filterGroups(listOf([resource(1), resource(2)], []))).toEqual([])
  })

  it('offers the translations and the platforms that differ', () => {
    const items = listOf(
      [resource(1, { translation: 'official', platform: ['and', 'win'] })],
      [entry('a', { translation: 'group' }), entry('b')],
    )
    expect(filterGroups(items).slice(1)).toEqual([
      { name: 'language', options: ['zh', 'jp'] },
      { name: 'translation', options: ['official', 'group', 'machine'] },
      { name: 'platform', options: ['win', 'and'] },
    ])
  })
})

describe('pick', () => {
  const items = listOf(
    [
      resource(1, { updated: '2026-03-01T00:00:00Z', downloads: 5 }, [300]),
      resource(2, { updated: '2026-05-01T00:00:00Z', downloads: 9, language: ['zh'] }, [200, 200]),
    ],
    [
      entry('save', { kind: 'save', translation: null, updated: '2026-09-01T00:00:00Z' }),
      entry('old', { updated: '2025-01-01T00:00:00Z', downloads: 70, size: 5 }),
      entry('new', { updated: '2026-08-01T00:00:00Z', downloads: 2, size: null }),
      entry('big', { updated: '2026-02-01T00:00:00Z', translation: 'group', size: 900 }),
    ],
  )

  it('keeps games first, then patches, then saved games, newest first within each', () => {
    expect(keys(pick(items, noFilter, 'updated'))).toEqual([
      'site-2',
      'site-1',
      'moyu-new',
      'moyu-big',
      'moyu-old',
      'moyu-save',
    ])
  })

  it('sorts within a kind by downloads and by size, with an unknown size last', () => {
    expect(keys(pick(items, noFilter, 'downloads')).slice(0, 5)).toEqual([
      'site-2',
      'site-1',
      'moyu-old',
      'moyu-new',
      'moyu-big',
    ])
    expect(keys(pick(items, noFilter, 'smallest')).slice(0, 5)).toEqual([
      'site-1',
      'site-2',
      'moyu-old',
      'moyu-big',
      'moyu-new',
    ])
    expect(keys(pick(items, noFilter, 'largest')).slice(0, 5)).toEqual([
      'site-2',
      'site-1',
      'moyu-big',
      'moyu-old',
      'moyu-new',
    ])
  })

  it('takes any choice within a group and every group at once', () => {
    expect(keys(pick(items, only({ kind: ['game', 'save'] }), 'updated'))).toEqual([
      'site-2',
      'site-1',
      'moyu-save',
    ])
    expect(keys(pick(items, only({ kind: ['patch'], translation: ['group'] }), 'updated'))).toEqual(
      ['moyu-big'],
    )
    expect(pick(items, only({ kind: ['save'], translation: ['group'] }), 'updated')).toEqual([])
  })
})

describe('offered', () => {
  it('drops the choices a list no longer offers', () => {
    const groups = filterGroups(listOf([resource(1)], [entry('a')]))
    const filter = only({ kind: ['patch', 'save'], platform: ['and'], language: ['zh'] })
    expect(offered(filter, groups)).toEqual(only({ kind: ['patch'], language: ['zh'] }))
    expect(filterCount(offered(filter, groups))).toBe(2)
    expect(filterCount(noFilter)).toBe(0)
  })
})
