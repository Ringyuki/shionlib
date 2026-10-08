import { describe, expect, it } from 'vitest'
import { knownLinkError } from './account'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'

describe('knownLinkError', () => {
  it('names only the reasons the page can explain', () => {
    expect(knownLinkError('link_conflict')).toBe('link_conflict')
    expect(knownLinkError('provider')).toBeUndefined()
    expect(knownLinkError(undefined)).toBeUndefined()
  })

  it('has a message for each of them in every language', () => {
    for (const messages of [zh, en, ja]) {
      expect(Object.keys(messages.identity.linkError).sort()).toEqual([
        'email_unverified',
        'link_auth',
        'link_conflict',
      ])
    }
  })
})
