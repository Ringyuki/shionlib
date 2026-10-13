import { describe, expect, it } from 'vitest'
import { blankInfo, mostTranslators, type InfoValues } from './resource-info'
import { infoIssues } from './resource-info.schema'

const values = (patch: Partial<InfoValues>, language: string[] = ['zh']) => ({
  ...blankInfo,
  form: 'portable' as const,
  ...patch,
  language,
})

const issuesOf = (patch: Partial<InfoValues>, language?: string[], complete = true) =>
  infoIssues(values(patch, language), complete).map(([, issue]) => issue)

describe('infoIssues', () => {
  it('accepts an original and a credited translation', () => {
    expect(issuesOf({}, ['jp'])).toEqual([])
    expect(issuesOf({ translation: 'group', translators: ['绿茶汉化组'] })).toEqual([])
    expect(issuesOf({ translation: 'official' })).toEqual([])
  })

  it('asks where a translation comes from when the resource is being created', () => {
    expect(issuesOf({})).toEqual(['translation'])
    expect(issuesOf({}, ['zh'], false)).toEqual([])
  })

  it('asks for the form when the resource is being created', () => {
    expect(issuesOf({ form: '' }, ['jp'])).toEqual(['form'])
    expect(issuesOf({ form: '' }, ['jp'], false)).toEqual([])
  })

  it('needs a translator for a translation by a group, and not too many', () => {
    expect(issuesOf({ translation: 'group' }, ['zh'], false)).toEqual(['translators'])
    const many = Array.from({ length: mostTranslators + 1 }, (_, index) => `汉化组 ${index}`)
    expect(issuesOf({ translation: 'group', translators: many })).toEqual(['tooManyTranslators'])
  })

  it('takes only a web address as the release page', () => {
    const release = (releaseUrl: string) => issuesOf({ translation: 'machine', releaseUrl })
    expect(release(' https://example.org/patch ')).toEqual([])
    expect(release('')).toEqual([])
    expect(release('example.org')).toEqual(['releaseUrl'])
    expect(release('javascript:alert(1)')).toEqual(['releaseUrl'])
    expect(release('https://example.org/a b')).toEqual(['releaseUrl'])
  })

  it('ignores what a hidden field still holds', () => {
    const stale = { translation: 'group', releaseUrl: 'nonsense' } as const
    expect(issuesOf(stale, ['jp'])).toEqual([])
    expect(issuesOf({ translation: 'official', releaseUrl: 'nonsense' })).toEqual([])
  })

  it('names the field each issue belongs to', () => {
    expect(infoIssues(values({ translation: 'group', form: '' }), true)).toEqual([
      ['translators', 'translators'],
      ['form', 'form'],
    ])
  })
})
