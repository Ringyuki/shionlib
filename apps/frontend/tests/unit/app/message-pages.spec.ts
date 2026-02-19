import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageType } from '../../../interfaces/message/message.interface'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))

  const Messages = vi.fn(({ messages }: { messages: Array<{ id: number }> }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'messages',
        'data-count': String(messages.length),
      },
      'm',
    ),
  )

  return {
    get,
    requestFactory,
    Messages,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/message/message/Messages', () => ({
  Messages: hoisted.Messages,
}))

describe('app/[locale]/(main)/message* pages (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('loads message list with optional type/unread filters', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 1 }],
        meta: { totalItems: 1 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/message/page')
    const element = await pageModule.default({
      searchParams: Promise.resolve({ page: '2', type: MessageType.SYSTEM, unread: true }),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/message/list', {
      params: {
        page: '2',
        pageSize: 15,
        type: MessageType.SYSTEM,
        unread: true,
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="messages"')
    expect(html).toContain('data-count="1"')
  })

  it('loads comment-like messages with fixed type', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 2 }, { id: 3 }],
        meta: { totalItems: 2 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/message/comment-like/page')
    await pageModule.default({ searchParams: Promise.resolve({ page: '1', unread: true }) })

    expect(hoisted.get).toHaveBeenCalledWith('/message/list', {
      params: {
        page: '1',
        pageSize: 15,
        unread: true,
        type: MessageType.COMMENT_LIKE,
      },
    })
  })

  it('loads comment-reply messages with fixed type', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 4 }],
        meta: { totalItems: 1 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/message/comment-reply/page')
    await pageModule.default({ searchParams: Promise.resolve({ page: '3', unread: false }) })

    expect(hoisted.get).toHaveBeenCalledWith('/message/list', {
      params: {
        page: '3',
        pageSize: 15,
        type: MessageType.COMMENT_REPLY,
      },
    })
  })

  it('loads system messages with fixed type', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [],
        meta: { totalItems: 0 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/message/system/page')
    await pageModule.default({ searchParams: Promise.resolve({ page: '1', unread: true }) })

    expect(hoisted.get).toHaveBeenCalledWith('/message/list', {
      params: {
        page: '1',
        pageSize: 15,
        unread: true,
        type: MessageType.SYSTEM,
      },
    })
  })
})
