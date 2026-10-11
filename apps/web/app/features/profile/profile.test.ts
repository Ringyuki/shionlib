import { describe, expect, it } from 'vitest'
import {
  backgroundFor,
  countOf,
  openingTab,
  otherFiles,
  profilePath,
  shownTabs,
  tabAt,
  uploadPath,
} from './profile'
import { parseOptional } from '~/shared/form/check'
import { profileEdit, removed } from './profile.schema'

const counts = (uploads: number, favorites: number, comments: number, walkthroughs: number) => ({
  resource_count: uploads,
  favorite_count: favorites,
  comment_count: comments,
  walkthrough_count: walkthroughs,
})

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
    expect(tabAt('/zh/user/3/comments', 'zh', 3)).toBe('comments')
  })
})

describe('tabs', () => {
  it('counts each tab with what the profile says', () => {
    const profile = counts(1, 2, 3, 4)
    expect(countOf(profile, 'uploads')).toBe(1)
    expect(countOf(profile, 'favorites')).toBe(2)
    expect(countOf(profile, 'comments')).toBe(3)
    expect(countOf(profile, 'walkthroughs')).toBe(4)
  })

  it('shows a visitor the tabs with content and the one that is open', () => {
    expect(shownTabs(counts(0, 5, 0, 1), false, 'favorites')).toEqual(['favorites', 'walkthroughs'])
    expect(shownTabs(counts(0, 5, 0, 1), false, 'comments')).toEqual([
      'favorites',
      'comments',
      'walkthroughs',
    ])
    expect(shownTabs(counts(0, 0, 0, 0), false, 'uploads')).toEqual([])
  })

  it('shows the user every tab, also the empty ones', () => {
    expect(shownTabs(counts(0, 0, 0, 0), true, 'uploads')).toEqual([
      'uploads',
      'favorites',
      'comments',
      'walkthroughs',
    ])
  })

  it('opens the first tab that has content', () => {
    expect(openingTab(counts(0, 0, 2, 1))).toBe('comments')
    expect(openingTab(counts(3, 0, 2, 1))).toBe('uploads')
    expect(openingTab(counts(0, 0, 0, 0))).toBeUndefined()
  })
})

describe('backgroundFor', () => {
  const profile = { id: 3, background: 'user/3/background/a.webp' }

  it('shows the background to guests and to viewers who did not turn it off', () => {
    expect(backgroundFor(profile, null)).toBe(profile.background)
    expect(backgroundFor(profile, { id: 9, show_profile_backgrounds: true })).toBe(
      profile.background,
    )
    expect(backgroundFor({ id: 3, background: null }, null)).toBeNull()
  })

  it('hides the backgrounds of others from a viewer who turned them off, never their own', () => {
    expect(backgroundFor(profile, { id: 9, show_profile_backgrounds: false })).toBeNull()
    expect(backgroundFor(profile, { id: 3, show_profile_backgrounds: false })).toBe(
      profile.background,
    )
  })
})

describe('uploads', () => {
  it('leads to the resource on the page of its game', () => {
    expect(uploadPath('zh', { id: 12, game: { id: 5 } })).toBe('/zh/game/5#resource-12')
  })

  it('counts the files beside the one that is named', () => {
    expect(otherFiles({ files_count: 1 })).toBe(0)
    expect(otherFiles({ files_count: 3 })).toBe(2)
    expect(otherFiles({ files_count: 0 })).toBe(0)
  })
})

describe('profileEdit', () => {
  const picture = new File(['image'], 'a.webp', { type: 'image/webp' })

  it('takes texts, pictures and the mark of a removed picture', () => {
    const form = new FormData()
    form.append('bio', '春')
    form.append('avatar', picture)
    form.append('cover', removed)
    expect(parseOptional(profileEdit, Object.fromEntries(form))).toMatchObject({
      bio: '春',
      cover: removed,
    })
    form.set('avatar', 'not a picture')
    expect(parseOptional(profileEdit, Object.fromEntries(form))).toBeUndefined()
  })
})
