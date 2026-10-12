import { describe, expect, it } from 'vitest'
import { adminAddress, adminPaths, navigationOf, searchSet, titleOf } from './admin'

describe('adminAddress', () => {
  it('leaves the Chinese address and everything outside the admin alone', () => {
    expect(adminAddress('/zh/admin/reports', '?id=3')).toBeUndefined()
    expect(adminAddress('/en/game/1', '')).toBeUndefined()
  })

  it('moves an admin address in another language to the Chinese one', () => {
    expect(adminAddress('/en/admin', '')).toBe('/zh/admin')
    expect(adminAddress('/ja/admin/reports', '?id=3')).toBe('/zh/admin/reports?id=3')
  })
})

describe('navigationOf', () => {
  const pending = { reports: 2, malware_cases: 1, stalled_files: 3, comments: 9, walkthroughs: 0 }

  it('counts both kinds of file checks under one entry', () => {
    const [review] = navigationOf(pending).groups
    expect(review?.entries.map(({ key, count }) => [key, count])).toEqual([
      ['reports', 2],
      ['checks', 4],
    ])
  })

  it('marks only the overview as an exact address', () => {
    const { lead, groups } = navigationOf(pending)
    expect(lead).toEqual([{ key: 'overview', to: adminPaths.overview, end: true, count: 0 }])
    expect(groups.flatMap(group => group.entries).every(entry => !entry.end)).toBe(true)
  })
})

describe('titleOf', () => {
  it('prefers the Chinese title, then the Japanese, then the English', () => {
    expect(titleOf({ title_zh: '千恋万花', title_jp: '千恋＊万花', title_en: 'Senren' })).toBe(
      '千恋万花',
    )
    expect(titleOf({ title_zh: '', title_jp: '千恋＊万花', title_en: 'Senren' })).toBe('千恋＊万花')
    expect(titleOf({ title_zh: '', title_jp: '', title_en: 'Senren' })).toBe('Senren')
    expect(titleOf({ title_zh: '', title_jp: '', title_en: '' })).toBe('')
  })
})

describe('searchSet', () => {
  it('sets, replaces and removes one key and keeps the rest', () => {
    expect(searchSet('?status=ALL', 'id', '4')).toBe('?status=ALL&id=4')
    expect(searchSet('?status=ALL&id=4', 'id', '5')).toBe('?status=ALL&id=5')
    expect(searchSet('?status=ALL&id=4', 'id', undefined)).toBe('?status=ALL')
    expect(searchSet('?id=4', 'id', undefined)).toBe('')
  })
})

describe('adminPaths', () => {
  it('opens one item on its list page', () => {
    expect(adminPaths.report(7)).toBe('/zh/admin/reports?id=7')
    expect(adminPaths.scanCase(3)).toBe('/zh/admin/checks?case=3')
    expect(adminPaths.user(12)).toBe('/zh/admin/users/12')
  })
})
