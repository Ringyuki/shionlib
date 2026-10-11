import { describe, expect, it } from 'vitest'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import {
  aimsAt,
  commentAnchor,
  commentPath,
  commentsPath,
  firstLine,
  isPending,
  likesOf,
  pathOfComment,
  pinRightsOver,
  resourceCommentPath,
  searchFocusing,
  searchInOrder,
  searchOfFocused,
} from './comment'
import { commentForm, focusFrom, threadOrderFrom } from './comment.schema'

describe('pinning', () => {
  const resource = { kind: 'resource', id: 31 } as const
  const thread = { parent_id: null, status: 1, pinned: false }
  const publisher = { id: 5, role: 1 }

  it('lets the publisher pin a visible comment that starts a thread and unpin the pinned one', () => {
    expect(pinRightsOver(thread, resource, 5, publisher)).toEqual({ pin: true, unpin: false })
    expect(pinRightsOver({ ...thread, pinned: true }, resource, 5, publisher)).toEqual({
      pin: false,
      unpin: true,
    })
  })

  it('offers nothing on a reply, a comment under review or a comment on a game', () => {
    const nothing = { pin: false, unpin: false }
    expect(pinRightsOver({ ...thread, parent_id: 2 }, resource, 5, publisher)).toEqual(nothing)
    expect(pinRightsOver({ ...thread, status: 2 }, resource, 5, publisher)).toEqual(nothing)
    expect(pinRightsOver(thread, { kind: 'game', id: 7 }, 5, publisher)).toEqual(nothing)
    expect(pinRightsOver(thread, resource, 5, undefined)).toEqual(nothing)
  })

  it('lets an admin unpin but never pin, and gives other users nothing', () => {
    const pinned = { ...thread, pinned: true }
    expect(pinRightsOver(pinned, resource, 5, { id: 8, role: 2 })).toEqual({
      pin: false,
      unpin: true,
    })
    expect(pinRightsOver(thread, resource, 5, { id: 8, role: 2 })).toEqual({
      pin: false,
      unpin: false,
    })
    expect(pinRightsOver(pinned, resource, 5, { id: 8, role: 1 })).toEqual({
      pin: false,
      unpin: false,
    })
  })
})

describe('addresses', () => {
  it('leads to a comment on the page of what it was made on', () => {
    expect(resourceCommentPath('zh', 31, 12)).toBe('/zh/resource/31/comments?comment=12')
    expect(pathOfComment('zh', { id: 12, game: { id: 7 }, resource: null })).toBe(
      '/zh/game/7/comments?comment=12',
    )
    expect(pathOfComment('zh', { id: 12, game: { id: 7 }, resource: { id: 31 } })).toBe(
      '/zh/resource/31/comments?comment=12',
    )
  })

  it('places the comments on a tab of the game and names each comment', () => {
    expect(commentsPath('zh', 7)).toBe('/zh/game/7/comments')
    expect(commentAnchor(12)).toBe('comment-12')
  })

  it('keeps the newest order out of the address and goes back to the first page', () => {
    expect(searchInOrder('?page=3', 'oldest')).toBe('?order=oldest')
    expect(searchInOrder('?order=oldest&page=2', 'newest')).toBe('')
  })

  it('asks for the page of a comment and then names the comment on that page', () => {
    expect(commentPath('zh', 7, 12)).toBe('/zh/game/7/comments?comment=12')
    expect(searchFocusing('?order=oldest&page=3', 12)).toBe('?order=oldest&comment=12')
    expect(searchOfFocused('?order=oldest&comment=12', 3)).toBe('?order=oldest&page=3')
    expect(searchOfFocused('?comment=12', 1)).toBe('')
    expect(aimsAt('#comment-12', 12)).toBe(true)
    expect(aimsAt('#comment-120', 12)).toBe(false)
  })

  it('reads the comment an address asks for and ignores anything else', () => {
    expect(focusFrom('12')).toBe(12)
    expect(focusFrom('0')).toBeUndefined()
    expect(focusFrom('abc')).toBeUndefined()
    expect(focusFrom(null)).toBeUndefined()
  })

  it('reads the order and falls back on the newest', () => {
    expect(threadOrderFrom('oldest')).toBe('oldest')
    expect(threadOrderFrom('best')).toBe('newest')
    expect(threadOrderFrom(null)).toBe('newest')
  })
})

describe('firstLine', () => {
  it('quotes the first line of a comment', () => {
    expect(firstLine('  解压失败\n第二行')).toBe('解压失败')
    expect(firstLine('一行')).toBe('一行')
    expect(firstLine('')).toBe('')
  })
})

describe('isPending', () => {
  it('holds while a comment waits for review', () => {
    expect(isPending({ status: 2 })).toBe(true)
    expect(isPending({ status: 1 })).toBe(false)
  })
})

describe('likesOf', () => {
  const liked = { is_liked: true, like_count: 3 }
  const plain = { is_liked: false, like_count: 0 }

  it('shows what is stored until the viewer changes it', () => {
    expect(likesOf(liked, undefined)).toEqual({ liked: true, count: 3 })
  })

  it('shows a change before it is stored', () => {
    expect(likesOf(plain, { from: false })).toEqual({ liked: true, count: 1 })
    expect(likesOf(liked, { from: true })).toEqual({ liked: false, count: 2 })
  })

  it('drops a change once the stored state has caught up', () => {
    expect(likesOf(liked, { from: false })).toEqual({ liked: true, count: 3 })
  })
})

describe('commentForm', () => {
  const written: RichDocument = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '好' }] }],
  }

  const spaces: RichDocument = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '  ' }] },
      { type: 'paragraph' },
    ],
  }

  it('asks for something to be written', () => {
    const rules = commentForm(issue => issue)
    expect(rules['~run']({ value: { content: blankDocument } }, {}).issues?.[0]?.message).toBe(
      'empty',
    )
    expect(rules['~run']({ value: { content: spaces } }, {}).issues?.[0]?.message).toBe('empty')
    expect(rules['~run']({ value: { content: written } }, {}).issues).toBeUndefined()
  })
})
