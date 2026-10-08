import { describe, expect, it } from 'vitest'
import { lexicalDocument } from '~/shared/markup/lexical-document'
import { commentAnchor, commentsPath, isPending, likesOf, searchInOrder, sourceOf } from './comment'
import { commentForm, threadOrderFrom } from './comment.schema'

describe('addresses', () => {
  it('places the comments on a tab of the game and names each comment', () => {
    expect(commentsPath('zh', 7)).toBe('/zh/game/7/comments')
    expect(commentAnchor(12)).toBe('comment-12')
  })

  it('keeps the newest order out of the address and goes back to the first page', () => {
    expect(searchInOrder('?page=3', 'oldest')).toBe('?order=oldest')
    expect(searchInOrder('?order=oldest&page=2', 'newest')).toBe('')
  })

  it('reads the order and falls back on the newest', () => {
    expect(threadOrderFrom('oldest')).toBe('oldest')
    expect(threadOrderFrom('best')).toBe('newest')
    expect(threadOrderFrom(null)).toBe('newest')
  })
})

describe('sourceOf', () => {
  it('gives the text of a comment the way it is written and edited', () => {
    expect(sourceOf({ content: lexicalDocument('[b]好[/b]\n第二行') })).toBe('[b]好[/b]\n第二行')
  })

  it('is empty for content it cannot read', () => {
    expect(sourceOf({ content: null })).toBe('')
    expect(sourceOf({ content: 'text' })).toBe('')
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
  it('asks for something to be written', () => {
    const rules = commentForm(issue => issue)
    expect(rules['~run']({ value: { content: '  \n ' } }, {}).issues?.[0]?.message).toBe('empty')
    expect(rules['~run']({ value: { content: '好' } }, {}).issues).toBeUndefined()
  })
})
