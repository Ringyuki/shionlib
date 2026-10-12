import { describe, expect, it } from 'vitest'
import {
  branchKey,
  entriesById,
  entryPageSize,
  expandable,
  matchParts,
  meaningOf,
  namesOf,
  notedOf,
  topTotal,
  trackSeconds,
  treeOf,
  unreadState,
  viewSearch,
  wanting,
  withPage,
  type Branches,
} from './inspection'
import { entry, folder } from './inspection-testing'

const game = folder(1, 'Game', 3)

const tree: Branches = {
  [branchKey(null)]: {
    entries: [game, entry(2, { name: 'readme.txt' })],
    total: 2,
    loading: false,
  },
  [branchKey(1)]: {
    entries: [folder(3, 'voice', 450, 1), entry(4, { name: 'game.exe', parent_id: 1 })],
    total: 3,
    loading: false,
  },
}

describe('the tree of entries', () => {
  it('nests what was loaded and leaves a placeholder where a folder was not opened yet', () => {
    expect(treeOf(tree)).toEqual([
      {
        value: 1,
        label: 'Game',
        children: [
          { value: 3, label: 'voice', children: [{ value: 'load:3:1', label: '' }] },
          { value: 4, label: 'game.exe' },
          { value: 'more:1', label: '' },
        ],
      },
      { value: 2, label: 'readme.txt' },
    ])
  })

  it('asks for the first page of a listing that was never loaded', () => {
    expect(treeOf({})).toEqual([{ value: 'load:top:1', label: '' }])
  })

  it('turns the offer of more into a page being loaded, and that page into entries', () => {
    const asked = wanting(tree, 1)
    expect(treeOf(asked)[0]?.children?.at(-1)).toEqual({ value: 'load:1:1', label: '' })
    const full = withPage(asked, 1, { entries: [entry(5, { parent_id: 1 })], total: 3 })
    expect(full[branchKey(1)]).toMatchObject({ total: 3, loading: false })
    expect(treeOf(full)[0]?.children?.map(node => node.value)).toEqual([3, 4, 5])
    expect(wanting(tree, 99)).toBe(tree)
  })

  it('asks for the page after the ones a folder already shows', () => {
    const entries = Array.from({ length: entryPageSize * 2 }, (_, index) =>
      entry(100 + index, { parent_id: 3 }),
    )
    const loaded = wanting(withPage(tree, 3, { entries, total: 450 }), 3)
    const voice = treeOf(loaded)[0]?.children?.[0]
    expect(voice?.children?.at(-1)).toEqual({ value: 'load:3:3', label: '' })
  })

  it('does not repeat an entry a page delivers twice', () => {
    const again = withPage(tree, 1, { entries: [entry(4, { parent_id: 1 })], total: 3 })
    expect(again[branchKey(1)]?.entries.map(known => known.id)).toEqual([3, 4])
  })

  it('opens only what holds something', () => {
    expect(expandable(game)).toBe(true)
    expect(expandable(folder(9, 'empty', 0))).toBe(false)
    expect(expandable(entry(9, { kind: 'archive', children: 2 }))).toBe(true)
    expect(expandable(entry(9, { kind: 'disc', children: 0, unreadable: true }))).toBe(false)
    expect(expandable(entry(9, { kind: 'track', children: 0 }))).toBe(false)
    expect(expandable(entry(9))).toBe(false)
  })
})

describe('what a row stands for', () => {
  const known = entriesById(tree)

  it('finds an entry by its id', () => {
    expect(meaningOf(tree, known, 4)).toEqual({
      kind: 'entry',
      entry: tree[branchKey(1)]?.entries[1],
    })
    expect(meaningOf(tree, known, 99)).toBeUndefined()
  })

  it('reads a placeholder as the page to load and an offer as what is left', () => {
    expect(meaningOf(tree, known, 'load:3:2')).toEqual({
      kind: 'loading',
      place: { parent: 3, page: 2 },
    })
    expect(meaningOf(tree, known, 'load:top:1')).toEqual({
      kind: 'loading',
      place: { parent: null, page: 1 },
    })
    expect(meaningOf(tree, known, 'more:1')).toEqual({ kind: 'more', parent: 1, left: 1 })
    expect(meaningOf(tree, known, 'more:7')).toBeUndefined()
    expect(meaningOf(tree, known, 'nonsense')).toBeUndefined()
  })

  it('counts what the top level holds', () => {
    expect(topTotal(tree)).toBe(2)
    expect(topTotal({})).toBe(0)
  })
})

describe('the address of a view', () => {
  it('names the file only when it is not the first one, and the filter only when there is one', () => {
    expect(viewSearch({ inspectionId: 7, query: '' }, 7)).toBe('')
    expect(viewSearch({ inspectionId: 8, query: ' exe ' }, 7)).toBe('?file=8&q=exe')
    expect(viewSearch({ inspectionId: 7, query: '設定' }, 7)).toBe(
      `?q=${encodeURIComponent('設定')}`,
    )
    expect(viewSearch({}, undefined)).toBe('')
  })
})

describe('what a row shows', () => {
  it('splits a name around the first match, whatever its case', () => {
    expect(matchParts('Setup.EXE.sig', 'exe')).toEqual(['Setup.', 'EXE', '.sig'])
    expect(matchParts('readme.txt', 'exe')).toEqual(['readme.txt', '', ''])
    expect(matchParts('readme.txt', '')).toEqual(['readme.txt', '', ''])
  })

  it('reads the length of a track in minutes and seconds', () => {
    expect(trackSeconds(entry(1, { track: { number: 2, seconds: 271 } }))).toEqual({
      minutes: 4,
      seconds: 31,
    })
    expect(trackSeconds(entry(1))).toEqual({ minutes: 0, seconds: 0 })
  })

  it('notes how much a container holds and how long a track lasts, when that is known', () => {
    const say = {
      duration: (length: { minutes: number; seconds: number }) =>
        `${length.minutes}:${length.seconds}`,
      items: (count: number) => `${count} items`,
    }
    expect(notedOf(folder(1, 'Game', 3), say)).toBe('3 items')
    expect(notedOf(entry(2), say)).toBe('')
    expect(notedOf(entry(3, { kind: 'track', track: { number: 2, seconds: 271 } }), say)).toBe(
      '4:31',
    )
    expect(notedOf(entry(3, { kind: 'track', track: { number: 2, seconds: 0 } }), say)).toBe('')
  })

  it('says why nothing is listed yet', () => {
    expect(unreadState([{ stage: 'stored' }, { stage: 'checking' }])).toBe('reading')
    expect(unreadState([{ stage: 'stalled' }])).toBe('failed')
    expect(unreadState([{ stage: 'rejected' }])).toBe('failed')
    expect(unreadState([{ stage: 'stored' }, { stage: 'rejected' }])).toBe('unread')
    expect(unreadState([{ stage: 'stored' }])).toBe('unread')
    expect(unreadState([])).toBe('unread')
  })

  it('lists the files that share an inspection', () => {
    const files = [
      { file_name: 'game.part1.rar', inspection_id: 7, stage: 'stored' as const },
      { file_name: 'bonus.zip', inspection_id: 8, stage: 'stored' as const },
      { file_name: 'game.part2.rar', inspection_id: 7, stage: 'stored' as const },
      { file_name: 'old.7z', inspection_id: null, stage: 'stored' as const },
    ]
    expect(namesOf(files, 7)).toEqual(['game.part1.rar', 'game.part2.rar'])
    expect(namesOf(files, 9)).toEqual([])
  })
})
