import { describe, expect, it } from 'vitest'
import { sitePaths, navSections } from '~/features/shell'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'
import {
  atInbox,
  categories,
  categoryOf,
  inboxPath,
  inboxRoot,
  linkTarget,
  typeOf,
} from './message'
import { categoryFrom, openedFrom, unreadFrom } from './message.schema'

describe('categories', () => {
  it('map to the message types of the API and back', () => {
    expect(typeOf('all')).toBeUndefined()
    expect(typeOf('comment-reply')).toBe('COMMENT_REPLY')
    for (const category of categories) {
      const type = typeOf(category)
      if (type !== undefined) {
        expect(categoryOf(type)).toBe(category)
      }
    }
  })

  it('are read from the address, which keeps the old paths', () => {
    expect(categoryFrom(undefined)).toBe('all')
    expect(categoryFrom('system')).toBe('system')
    expect(categoryFrom('comment-like')).toBe('comment-like')
    expect(categoryFrom('all')).toBeUndefined()
    expect(categoryFrom('spam')).toBeUndefined()
  })

  it('are named in every language, with a text for an empty list', () => {
    for (const messages of [zh, en, ja]) {
      expect(Object.keys(messages.category).sort()).toEqual([...categories].sort())
      expect(Object.keys(messages.empty).sort()).toEqual([...categories].sort())
    }
  })
})

describe('inboxPath', () => {
  it('starts where the sidebar links to', () => {
    const messages = navSections('zh', 7)
      .flatMap(section => section.entries)
      .find(entry => entry.key === 'messages')
    expect(inboxRoot('zh')).toBe(messages?.to)
    expect(inboxPath('zh', { category: 'all' })).toBe(inboxRoot('zh'))
    expect(sitePaths('zh').home).toBe('/zh')
  })

  it('keeps the category in the path and the page and the opened message in the query', () => {
    expect(inboxPath('ja', { category: 'system', page: 2, opened: 14 })).toBe(
      '/ja/message/system?page=2&m=14',
    )
    expect(inboxPath('en', { category: 'comment-like', page: 1 })).toBe('/en/message/comment-like')
    expect(openedFrom('14')).toBe(14)
    expect(openedFrom('x')).toBeUndefined()
    expect(openedFrom(null)).toBeUndefined()
  })

  it('knows when the visitor is in the inbox', () => {
    expect(atInbox('/zh/message', 'zh')).toBe(true)
    expect(atInbox('/zh/message/system', 'zh')).toBe(true)
    expect(atInbox('/zh/messages', 'zh')).toBe(false)
  })
})

describe('linkTarget', () => {
  it('keeps a link of the site inside the language of the page', () => {
    expect(linkTarget('ja', { link_url: '/admin/reports?id=5', external_link: false })).toEqual({
      external: false,
      href: '/ja/admin/reports?id=5',
    })
  })

  it('opens anything else elsewhere, and is nothing without an address', () => {
    expect(linkTarget('zh', { link_url: 'https://example.test/a', external_link: false })).toEqual({
      external: true,
      href: 'https://example.test/a',
    })
    expect(linkTarget('zh', { link_url: '/a', external_link: true })).toEqual({
      external: true,
      href: '/a',
    })
    expect(linkTarget('zh', { link_url: null, external_link: false })).toBeUndefined()
    expect(linkTarget('zh', { link_url: ' ', external_link: false })).toBeUndefined()
  })
})

describe('unreadFrom', () => {
  it('reads the count of an unread event', () => {
    expect(unreadFrom('{"unread":3}')).toBe(3)
    expect(unreadFrom('{"unread":"3"}')).toBeUndefined()
    expect(unreadFrom('not json')).toBeUndefined()
  })
})
