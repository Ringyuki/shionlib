import { describe, expect, it } from 'vitest'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import {
  aimsAt,
  commentAnchor,
  commentPath,
  commentsPath,
  isPending,
  likesOf,
  searchFocusing,
  searchInOrder,
  searchOfFocused,
} from './comment'
import { commentForm, focusFrom, threadOrderFrom } from './comment.schema'

describe('addresses', () => {
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
