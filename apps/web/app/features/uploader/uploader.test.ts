import { describe, expect, it } from 'vitest'
import { sitePaths } from '~/features/shell'
import type { Submission, Upload } from '~/features/upload'
import {
  emptinessOf,
  entriesOf,
  firstListing,
  heldSince,
  listingSearch,
  matchingTransfers,
  nothingUploaded,
  orderOf,
  orders,
  paceOf,
  scopeOf,
  stageOf,
  type Transfer,
} from './uploader'

const uploadsOf = (id: string, names: readonly string[]) =>
  names.map((name, index): Upload => ({
    id: `${id}-${index}`,
    submission: id,
    file: { name, size: 10, lastModified: 0 },
    sent: 0,
    speed: 0,
    phase: { name: 'queued' },
  }))

const transferOf = (id: string, label: string, ...names: string[]): Transfer => {
  const submission: Submission = {
    id,
    label,
    target: { kind: 'orphan' },
    phase: { name: 'uploading' },
  }
  return { submission, uploads: uploadsOf(id, names) }
}

const owned = (id: number) => ({ resource: { id } })

const queue = [
  transferOf('a', 'Sakura no Uta', 'uta.part1.rar'),
  transferOf('b', 'ATRI', 'atri.7z'),
]

const none = { processing: 0, published: 0 }

describe('scopeOf', () => {
  it('asks for every resource until a stage is chosen', () => {
    expect(scopeOf(undefined)).toBe('all')
    expect(scopeOf('processing')).toBe('processing')
    expect(scopeOf('published')).toBe('published')
  })
})

describe('stageOf', () => {
  const published = '2026-10-01T00:00:00Z'

  it('calls a resource published once it is public and every file is stored', () => {
    expect(stageOf({ published_at: published, files: [{ stage: 'stored' }] })).toBe('published')
  })

  it('keeps it processing while it is not public or a file has not settled', () => {
    expect(stageOf({ published_at: null, files: [{ stage: 'stored' }] })).toBe('processing')
    expect(stageOf({ published_at: null, files: null })).toBe('processing')
    for (const stage of ['checking', 'storing', 'under_review', 'stalled', 'rejected'] as const) {
      expect(stageOf({ published_at: published, files: [{ stage: 'stored' }, { stage }] })).toBe(
        'processing',
      )
    }
  })
})

describe('matchingTransfers', () => {
  it('keeps every transfer without a search', () => {
    expect(matchingTransfers(queue, ' ')).toEqual(queue)
  })

  it('matches part of the label or of a file name, whatever the case', () => {
    expect(matchingTransfers(queue, 'sakura')).toEqual([queue[0]])
    expect(matchingTransfers(queue, 'ATRI.7')).toEqual([queue[1]])
    expect(matchingTransfers(queue, 'missing')).toEqual([])
  })
})

describe('entriesOf', () => {
  it('lists what is uploading before the resources of the first page', () => {
    expect(entriesOf(firstListing, queue, [owned(7)]).map(entry => entry.key)).toEqual([
      'transfer:a',
      'transfer:b',
      'resource:7',
    ])
  })

  it('leaves transfers out of later pages and of the stages on the server', () => {
    const keys = (changes: Partial<typeof firstListing>) =>
      entriesOf({ ...firstListing, ...changes }, queue, [owned(7)]).map(entry => entry.key)
    expect(keys({ page: 2 })).toEqual(['resource:7'])
    expect(keys({ stage: 'processing' })).toEqual(['resource:7'])
    expect(keys({ stage: 'published' })).toEqual(['resource:7'])
  })

  it('narrows transfers by the search as well', () => {
    const entries = entriesOf({ ...firstListing, stage: 'uploading', search: 'atri' }, queue, [])
    expect(entries.map(entry => entry.key)).toEqual(['transfer:b'])
  })
})

describe('emptinessOf', () => {
  it('blames the search first', () => {
    expect(emptinessOf({ ...firstListing, search: 'x' }, none, 0)).toBe('unmatched')
  })

  it('says nothing was uploaded only while that is true', () => {
    expect(emptinessOf(firstListing, none, 0)).toBe('nothing')
    expect(emptinessOf({ ...firstListing, stage: 'published' }, none, 0)).toBe('nothing')
    expect(emptinessOf({ ...firstListing, stage: 'published' }, none, 1)).toBe('published')
  })

  it('names the empty stage otherwise', () => {
    const some = { processing: 0, published: 3 }
    expect(emptinessOf({ ...firstListing, stage: 'uploading' }, none, 0)).toBe('uploading')
    expect(emptinessOf({ ...firstListing, stage: 'processing' }, some, 0)).toBe('processing')
  })
})

describe('orderOf', () => {
  it('finds the order a listing is sorted by', () => {
    for (const order of orders) {
      expect(orderOf(order)).toBe(order)
    }
  })

  it('starts from the most recently updated', () => {
    expect(orderOf(firstListing).name).toBe('recent')
  })
})

describe('listingSearch', () => {
  it('keeps the first listing out of the URL', () => {
    expect(listingSearch(firstListing)).toBe('')
  })

  it('writes only what differs from the first listing', () => {
    expect(listingSearch({ ...firstListing, stage: 'processing', page: 3 })).toBe(
      '?status=processing&page=3',
    )
    expect(
      listingSearch({ ...firstListing, search: 'sakura no', sort: 'downloads', ascending: true }),
    ).toBe('?q=sakura+no&sort=downloads&order=asc')
  })
})

describe('paceOf', () => {
  const moving = (name: 'running' | 'paused' | 'failed' | 'done', sent: number, speed: number) => ({
    file: { size: 100 },
    sent,
    speed,
    phase: { name },
  })

  it('adds up what is running and tells how long the rest takes', () => {
    expect(paceOf([moving('running', 20, 10), moving('running', 60, 10)])).toEqual({
      speed: 20,
      seconds: 6,
    })
  })

  it('counts what waits as still to send, but not what failed', () => {
    expect(paceOf([moving('running', 50, 10), moving('paused', 0, 0)])?.seconds).toBe(15)
    expect(paceOf([moving('running', 50, 10), moving('failed', 0, 0)])?.seconds).toBe(5)
  })

  it('has nothing to say while nothing runs', () => {
    expect(paceOf([moving('paused', 50, 10), moving('done', 100, 0)])).toBeUndefined()
    expect(paceOf([])).toBeUndefined()
  })
})

describe('heldSince', () => {
  const first = { loaded: 1 }
  const second = { loaded: 2 }

  it('remembers what was loaded when a submission was first seen as submitted', () => {
    const held = heldSince(new Map(), ['a'], first)
    expect(held.get('a')).toBe(first)
    const later = heldSince(held, ['a', 'b'], second)
    expect(later.get('a')).toBe(first)
    expect(later.get('b')).toBe(second)
  })

  it('forgets submissions that are gone and otherwise keeps the same map', () => {
    const held = heldSince(new Map(), ['a', 'b'], first)
    expect(heldSince(held, ['a', 'b'], second)).toBe(held)
    expect([...heldSince(held, ['b'], second).keys()]).toEqual(['b'])
  })

  it('is what the rest of the site links to for what is uploading', () => {
    const paths = sitePaths('zh')
    expect(paths.uploading).toBe(
      `${paths.uploads}${listingSearch({ ...firstListing, stage: 'uploading' })}`,
    )
  })
})

describe('nothingUploaded', () => {
  it('holds only while there is neither a processing nor a published resource', () => {
    expect(nothingUploaded(none)).toBe(true)
    expect(nothingUploaded({ processing: 1, published: 0 })).toBe(false)
    expect(nothingUploaded({ processing: 0, published: 2 })).toBe(false)
  })
})
