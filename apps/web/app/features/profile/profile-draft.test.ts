import { describe, expect, it } from 'vitest'
import { draftOf, editOf, isChanged, shownPicture, withoutPicture } from './profile-draft'
import { removed } from './profile.schema'

const base = { bio: '春', cover: 'user/3/cover/a.webp', background: null }

const picked = (name: string) => ({
  file: new File(['image'], name, { type: 'image/webp' }),
  url: `blob:${name}`,
})

describe('a draft', () => {
  it('starts as the profile and changes nothing', () => {
    const draft = draftOf(base)
    expect(draft.bio).toBe('春')
    expect(isChanged(editOf(draft, base))).toBe(false)
    expect(isChanged(editOf({ ...draft, bio: ' 春 ' }, base))).toBe(false)
    expect(draftOf({ bio: null }).bio).toBe('')
  })

  it('sends the bio and the pictures that changed', () => {
    const avatar = picked('avatar')
    const edit = editOf({ ...draftOf(base), bio: '夏', avatar }, base)
    expect(edit).toEqual({
      bio: '夏',
      avatar: avatar.file,
      cover: undefined,
      background: undefined,
    })
    expect(isChanged(edit)).toBe(true)
  })

  it('removes a stored picture and forgets a picked one that was never stored', () => {
    const draft = { ...draftOf(base), cover: picked('cover'), background: picked('background') }
    const without = withoutPicture(withoutPicture(draft, 'cover', base), 'background', base)
    expect(without.cover).toBeNull()
    expect(without.background).toBeUndefined()
    expect(editOf(without, base)).toMatchObject({ cover: removed, background: undefined })
  })
})

describe('shownPicture', () => {
  it('shows the picked picture, else the stored one, and nothing once removed', () => {
    expect(shownPicture(picked('cover'), 'stored')).toBe('blob:cover')
    expect(shownPicture(undefined, 'stored')).toBe('stored')
    expect(shownPicture(undefined, null)).toBeUndefined()
    expect(shownPicture(null, 'stored')).toBeUndefined()
  })
})
