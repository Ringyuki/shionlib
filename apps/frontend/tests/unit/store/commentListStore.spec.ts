import { beforeEach, describe, expect, it } from 'vitest'
import { useCommentListStore } from '../../../store/commentListStore'

describe('store/commentListStore (unit)', () => {
  beforeEach(() => {
    useCommentListStore.setState({ comments: [] }, false)
  })

  it('adds, updates, removes and queries comments', () => {
    const c1 = { id: 1, html: 'a' } as any
    const c2 = { id: 2, html: 'b' } as any

    useCommentListStore.getState().addComment(c1)
    useCommentListStore.getState().addComment(c2)
    expect(useCommentListStore.getState().getLength()).toBe(2)
    expect(useCommentListStore.getState().getComment(2)?.html).toBe('b')

    useCommentListStore.getState().updateComment({ ...c2, html: 'b2' } as any)
    expect(useCommentListStore.getState().getComment(2)?.html).toBe('b2')

    useCommentListStore.getState().removeComment(1)
    expect(useCommentListStore.getState().getLength()).toBe(1)
    expect(useCommentListStore.getState().getComment(1)).toBeUndefined()
  })

  it('replaces list with setComments', () => {
    useCommentListStore.getState().setComments([
      { id: 10, html: 'x' },
      { id: 11, html: 'y' },
    ] as any)

    expect(useCommentListStore.getState().getLength()).toBe(2)
    expect(useCommentListStore.getState().getComment(10)?.html).toBe('x')
  })
})
