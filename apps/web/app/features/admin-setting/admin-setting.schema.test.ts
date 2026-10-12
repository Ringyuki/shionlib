import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import type { Schema } from '~/shared/api/types'
import { changeFrom, settingCommand, settingFrom, settingNameFrom } from './admin-setting.schema'

const raw: Schema<'SettingDTO'> = {
  name: 'download.max_conns',
  group: 'download',
  kind: 'int',
  label: '单个下载的连接数上限',
  description: '',
  value: 4,
  default: 8,
  min: 1,
  max: 64,
  overridden: true,
  last_change: {
    id: 2,
    previous: null,
    value: 4,
    editor: { id: 1, name: 'ringyuki' },
    created: '2026-10-06T06:31:50.478Z',
  },
}

describe('settingFrom', () => {
  it('reads a setting with its value, default and bounds', () => {
    expect(settingFrom(raw)).toEqual({
      name: 'download.max_conns',
      group: 'download',
      label: '单个下载的连接数上限',
      description: '',
      kind: 'int',
      value: 4,
      fallback: 8,
      min: 1,
      max: 64,
      maxLength: undefined,
      overridden: true,
      lastChange: { editor: 'ringyuki', at: '2026-10-06T06:31:50.478Z' },
    })
  })

  it('reads switches and texts, and a change made by the system', () => {
    const flag = settingFrom({
      ...raw,
      kind: 'flag',
      value: true,
      default: false,
      min: undefined,
      max: undefined,
    })
    expect(flag).toMatchObject({ kind: 'flag', value: true, fallback: false, min: undefined })
    const text = settingFrom({ ...raw, kind: 'text', value: 'a', default: 'b', max_length: 500 })
    expect(text).toMatchObject({ kind: 'text', value: 'a', maxLength: 500 })
    const seeded = settingFrom({
      ...raw,
      last_change: {
        ...raw.last_change,
        id: 1,
        previous: null,
        value: 4,
        editor: null,
        created: 'x',
      },
    })
    expect(seeded?.lastChange).toEqual({ editor: undefined, at: 'x' })
  })

  it('leaves out a setting whose value does not fit its kind', () => {
    expect(settingFrom({ ...raw, value: 'four' })).toBeUndefined()
    expect(settingFrom({ ...raw, kind: 'flag' })).toBeUndefined()
    expect(settingFrom({ ...raw, value: null })).toBeUndefined()
  })
})

describe('changeFrom', () => {
  it('reads a change, with nothing where the default applied', () => {
    expect(
      changeFrom({
        id: 4,
        previous: 35184372088832,
        value: null,
        editor: { id: 1, name: 'ringyuki' },
        created: 'x',
      }),
    ).toEqual({ id: 4, editor: 'ringyuki', at: 'x', previous: 35184372088832, value: undefined })
    expect(changeFrom({ id: 3, previous: null, value: true, editor: null, created: 'y' })).toEqual({
      id: 3,
      editor: undefined,
      at: 'y',
      previous: undefined,
      value: true,
    })
  })
})

describe('settingCommand', () => {
  it('takes at least one change of a number, a switch or a text', () => {
    const save = { changes: [{ name: 'user.registration', value: false, restore: false }] }
    expect(parseOptional(settingCommand, save)).toEqual(save)
    expect(parseOptional(settingCommand, { changes: [] })).toBeUndefined()
    expect(
      parseOptional(settingCommand, { changes: [{ name: 'x', value: null, restore: false }] }),
    ).toBeUndefined()
  })

  it('reads the name a history is asked for', () => {
    expect(settingNameFrom('upload.trusted_quota')).toBe('upload.trusted_quota')
    expect(settingNameFrom('')).toBeUndefined()
    expect(settingNameFrom(null)).toBeUndefined()
  })
})
