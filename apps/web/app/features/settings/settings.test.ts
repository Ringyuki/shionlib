import { describe, expect, it } from 'vitest'
import { sitePaths } from '~/features/shell'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'
import { firstSection, sectionAt, sectionPath, sections } from './settings'
import { sectionFrom } from './settings.schema'

describe('sections', () => {
  it('live under the address the shell links to', () => {
    expect(sectionPath('zh', 'security')).toBe(`${sitePaths('zh').settings}/security`)
  })

  it('are found from an address, starting with the profile', () => {
    expect(sectionAt('/ja/user/settings/site', 'ja')).toBe('site')
    expect(sectionAt('/ja/user/settings', 'ja')).toBe(firstSection)
    expect(sectionFrom('download')).toBe('download')
    expect(sectionFrom('billing')).toBeUndefined()
  })

  it('are named in every language', () => {
    for (const messages of [zh, en, ja]) {
      expect(Object.keys(messages.section).sort()).toEqual([...sections].sort())
    }
  })
})
