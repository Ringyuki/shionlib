import { describe, expect, it } from 'bun:test'
import { fitRow, languageTags, platformTags, softTags } from '../../src/cards/tags'
import { labelsOf } from '../../src/i18n/messages'

const zh = labelsOf('zh')

describe('tags', () => {
  it('orders platforms and languages the way the site does and drops duplicates', () => {
    expect(platformTags(['and', 'win', 'win'], zh)).toEqual([
      { kind: 'platform', platform: 'win', label: 'Windows' },
      { kind: 'platform', platform: 'and', label: 'Android' },
    ])
    expect(languageTags(['jp', 'zh', 'jp'], zh).map(tag => tag.label)).toEqual(['简中', '日文'])
  })

  it('keeps an unknown value as it is', () => {
    expect(platformTags(['web'], zh)).toEqual([{ kind: 'platform', platform: 'web', label: 'web' }])
  })

  it('leaves out empty labels', () => {
    expect(softTags(['主角', undefined, ''])).toEqual([{ kind: 'soft', label: '主角' }])
  })
})

describe('fitRow', () => {
  const tags = softTags(['相楽美佐枝', '一ノ瀬ことみ', '伊吹風子'])

  it('keeps every tag that fits beside the note', () => {
    expect(fitRow(tags, undefined, 662)).toHaveLength(3)
  })

  it('drops the tags at the end that would push the note out', () => {
    expect(fitRow(tags, '等 14 条线路', 681).map(tag => tag.label)).toEqual([
      '相楽美佐枝',
      '一ノ瀬ことみ',
    ])
  })
})
