import { describe, expect, it } from 'vitest'
import {
  byteUnits,
  drafted,
  durationUnits,
  edited,
  fittingUnit,
  hiddenValue,
  matching,
  problemOf,
  savesOf,
  sectioned,
  shownValue,
  unitsOf,
  type Setting,
} from './admin-setting'

const setting = (name: string, changes: Partial<Setting> = {}): Setting => ({
  name,
  group: name.split('.')[0] ?? '',
  label: name,
  description: '',
  kind: 'int',
  value: 3,
  fallback: 3,
  min: 1,
  max: 100,
  maxLength: undefined,
  overridden: false,
  lastChange: undefined,
  ...changes,
})

const quota = setting('upload.trusted_quota', {
  kind: 'bytes',
  label: '可信上传者存储上限',
  value: 4 * 1024 ** 4,
  fallback: 2 * 1024 ** 4,
  min: 0,
  max: 1024 ** 5,
  overridden: true,
})

const open = setting('user.registration', { kind: 'flag', value: true, fallback: true })

const note = setting('scan.auto_delete_note', {
  kind: 'text',
  value: 'x',
  fallback: 'x',
  maxLength: 5,
})

describe('sectioned', () => {
  it('puts registration and sponsorship together and keeps the given order of sections', () => {
    const sections = sectioned([quota, setting('sponsor.open'), open, setting('billing.rate')])
    expect(
      sections.map(section => [section.key, section.settings.map(entry => entry.name)]),
    ).toEqual([
      ['account', ['sponsor.open', 'user.registration']],
      ['upload', ['upload.trusted_quota']],
      ['other', ['billing.rate']],
    ])
  })
})

describe('matching', () => {
  it('finds a setting by its label, description or name', () => {
    const settings = [quota, open, setting('scan.review_timeout', { description: '复核时限' })]
    expect(matching(settings, ' 存储 ').map(entry => entry.name)).toEqual(['upload.trusted_quota'])
    expect(matching(settings, 'REGISTRATION').map(entry => entry.name)).toEqual([
      'user.registration',
    ])
    expect(matching(settings, '时限').map(entry => entry.name)).toEqual(['scan.review_timeout'])
    expect(matching(settings, '')).toHaveLength(3)
  })
})

describe('units', () => {
  it('shows a size or a duration in the largest unit that keeps it whole', () => {
    expect(fittingUnit(byteUnits, 30 * 1024 ** 3).unit).toBe('GiB')
    expect(fittingUnit(byteUnits, 1536 * 1024 ** 2).unit).toBe('MiB')
    expect(fittingUnit(byteUnits, 1000).unit).toBe('B')
    expect(fittingUnit(byteUnits, 0).unit).toBe('B')
    expect(fittingUnit(durationUnits, 604_800).unit).toBe('day')
    expect(fittingUnit(durationUnits, 5400).unit).toBe('minute')
  })

  it('gives units only to sizes and durations', () => {
    expect(unitsOf('bytes')).toBe(byteUnits)
    expect(unitsOf('duration')).toBe(durationUnits)
    expect(unitsOf('int')).toBeUndefined()
  })
})

describe('drafts', () => {
  it('keeps only what differs from the saved value', () => {
    const changed = drafted({}, open, false)
    expect(changed).toEqual({ 'user.registration': false })
    expect(shownValue(open, changed)).toBe(false)
    expect(edited([quota, open], changed)).toEqual([open])
    expect(drafted(changed, open, true)).toEqual({})
  })

  it('saves a return to the default as a restore', () => {
    const draft = { 'upload.trusted_quota': quota.fallback, 'user.registration': false }
    expect(savesOf([quota, open, note], draft)).toEqual([
      { name: 'upload.trusted_quota', value: quota.fallback, restore: true },
      { name: 'user.registration', value: false, restore: false },
    ])
  })
})

describe('secrets', () => {
  const kept = setting('bangumi.client_secret', {
    kind: 'secret',
    value: hiddenValue,
    fallback: '',
    overridden: true,
    maxLength: 500,
  })
  const unset = setting('oidc.client_secret', {
    kind: 'secret',
    value: '',
    fallback: '',
    maxLength: 500,
  })

  it('are grouped with the services they belong to', () => {
    expect(sectioned([kept, unset]).map(section => section.key)).toEqual(['credentials'])
  })

  it('are saved when typed and dropped when cleared, and left alone otherwise', () => {
    expect(savesOf([kept, unset], {})).toEqual([])
    expect(savesOf([kept, unset], { 'oidc.client_secret': 'typed' })).toEqual([
      { name: 'oidc.client_secret', value: 'typed', restore: false },
    ])
    expect(savesOf([kept, unset], { 'bangumi.client_secret': '' })).toEqual([
      { name: 'bangumi.client_secret', value: '', restore: true },
    ])
    expect(
      savesOf([kept, unset], drafted({ 'bangumi.client_secret': 'x' }, kept, hiddenValue)),
    ).toEqual([])
  })
})

describe('problemOf', () => {
  it('checks numbers against their bounds and their kind', () => {
    const count = setting('scan.check_attempts')
    expect(problemOf(count, 3)).toBeUndefined()
    expect(problemOf(count, 0)).toEqual({ kind: 'min', bound: 1 })
    expect(problemOf(count, 101)).toEqual({ kind: 'max', bound: 100 })
    expect(problemOf(count, 2.5)).toEqual({ kind: 'whole' })
    expect(problemOf(count, Number.NaN)).toEqual({ kind: 'number' })
    expect(problemOf(setting('hot_score.created', { kind: 'float' }), 2.5)).toBeUndefined()
  })

  it('checks a text against its length and leaves switches alone', () => {
    expect(problemOf(note, 'short')).toBeUndefined()
    expect(problemOf(note, 'too long')).toEqual({ kind: 'length', bound: 5 })
    expect(problemOf(open, false)).toBeUndefined()
  })
})
