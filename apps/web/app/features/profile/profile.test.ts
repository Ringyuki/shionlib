import { describe, expect, it } from 'vitest'
import { lastPage, otherFiles, profilePath, tabAt, uploadPath, uploadsSearch } from './profile'

describe('profilePath', () => {
  it('opens the uploads tab at the profile itself', () => {
    expect(profilePath('zh', 3)).toBe('/zh/user/3')
    expect(profilePath('ja', 3, 'favorites')).toBe('/ja/user/3/favorites')
  })
})

describe('tabAt', () => {
  it('finds the tab of an address, also inside a favorite list', () => {
    expect(tabAt('/zh/user/3', 'zh', 3)).toBe('uploads')
    expect(tabAt('/zh/user/3/favorites', 'zh', 3)).toBe('favorites')
    expect(tabAt('/zh/user/3/favorites/8', 'zh', 3)).toBe('favorites')
    expect(tabAt('/zh/user/30/favorites', 'zh', 3)).toBe('uploads')
  })
})

describe('uploads', () => {
  it('leads to the resource on the page of its game', () => {
    expect(uploadPath('zh', { id: 12, game: { id: 5 } })).toBe('/zh/game/5#resource-12')
  })

  it('keeps the first page out of the address', () => {
    expect(uploadsSearch(1)).toBe('')
    expect(uploadsSearch(2)).toBe('?page=2')
    expect(lastPage(0)).toBe(1)
    expect(lastPage(25)).toBe(2)
  })

  it('counts the files beside the one that is named', () => {
    expect(otherFiles({ files_count: 1 })).toBe(0)
    expect(otherFiles({ files_count: 3 })).toBe(2)
    expect(otherFiles({ files_count: 0 })).toBe(0)
  })
})
