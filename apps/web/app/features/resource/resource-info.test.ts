import { describe, expect, it } from 'vitest'
import {
  blankInfo,
  creditsOf,
  editionText,
  infoValuesFrom,
  missingInfo,
  patched,
  resourceInfo,
  translated,
  type InfoValues,
} from './resource-info'

const group: InfoValues = {
  ...blankInfo,
  translation: 'group',
  translators: ['绿茶汉化组', '熊喵守护协会'],
  patchVersion: ' v1.1 ',
  releaseUrl: ' https://example.org/patch ',
  form: 'portable',
  extras: ['bonus', 'save'],
}

describe('translated', () => {
  it('is any language other than Japanese', () => {
    expect(translated(['jp'])).toBe(false)
    expect(translated(['jp', 'zh'])).toBe(true)
    expect(translated([])).toBe(false)
  })
})

describe('resourceInfo', () => {
  it('sends the credits, the patch and the extras of a group translation', () => {
    expect(resourceInfo(group, ['zh'])).toEqual({
      translation: 'group',
      translators: ['绿茶汉化组', '熊喵守护协会'],
      patch_version: 'v1.1',
      release_url: 'https://example.org/patch',
      form: 'portable',
      extras: ['save', 'bonus'],
    })
  })

  it('leaves the translation out for a resource in Japanese only', () => {
    expect(resourceInfo(group, ['jp'])).toEqual({ form: 'portable', extras: ['save', 'bonus'] })
  })

  it('keeps the patch of a machine translation but no credits', () => {
    expect(resourceInfo({ ...group, translation: 'machine' }, ['zh'])).toMatchObject({
      translation: 'machine',
      patch_version: 'v1.1',
    })
    expect(resourceInfo({ ...group, translation: 'machine' }, ['zh'])).not.toHaveProperty(
      'translators',
    )
    expect(patched('official')).toBe(false)
  })

  it('drops the patch of an official translation and sends the edition', () => {
    const official: InfoValues = {
      ...group,
      translation: 'official',
      edition: 'steam',
      editionName: ' 豪華版 ',
    }
    expect(resourceInfo(official, ['zh'])).toEqual({
      translation: 'official',
      edition: 'steam',
      edition_name: '豪華版',
      form: 'portable',
      extras: ['save', 'bonus'],
    })
  })

  it('leaves out what nobody has said', () => {
    expect(resourceInfo(blankInfo, ['zh'])).toEqual({ extras: [] })
  })
})

describe('missingInfo', () => {
  it('names what a resource does not say yet', () => {
    expect(missingInfo({ language: ['zh'], translation: null, form: null })).toEqual([
      'translation',
      'form',
    ])
    expect(missingInfo({ language: ['jp'], translation: null, form: 'disc' })).toEqual([])
    expect(missingInfo({ language: ['zh'], translation: 'official', form: null })).toEqual(['form'])
    expect(missingInfo({ language: null, translation: null, form: 'portable' })).toEqual([])
  })
})

describe('stored information', () => {
  const stored = {
    translation: 'group',
    translators: [
      { id: 1, name: '绿茶汉化组' },
      { id: 2, name: '熊喵守护协会' },
    ],
    patch_version: 'v1.1',
    release_url: null,
    edition: 'package',
    edition_name: '初回限定版',
    form: 'disc',
    extras: ['save'],
  } as const

  it('fills the form with what a resource says', () => {
    expect(
      infoValuesFrom({ ...stored, translators: [...stored.translators], extras: ['save'] }),
    ).toEqual({
      translation: 'group',
      translators: ['绿茶汉化组', '熊喵守护协会'],
      patchVersion: 'v1.1',
      releaseUrl: '',
      edition: 'package',
      editionName: '初回限定版',
      form: 'disc',
      extras: ['save'],
    })
  })

  it('starts blank for a resource that says nothing', () => {
    expect(
      infoValuesFrom({
        translation: null,
        translators: null,
        patch_version: null,
        release_url: null,
        edition: null,
        edition_name: null,
        form: null,
        extras: null,
      }),
    ).toEqual(blankInfo)
  })

  it('credits translators only for a translation by a group', () => {
    expect(creditsOf({ translation: 'group', translators: [...stored.translators] })).toHaveLength(
      2,
    )
    expect(creditsOf({ translation: 'machine', translators: [...stored.translators] })).toEqual([])
    expect(creditsOf({ translation: 'group', translators: null })).toEqual([])
  })

  it('writes the edition with its name', () => {
    const label = (edition: string) => `<${edition}>`
    expect(editionText({ edition: 'package', edition_name: ' 初回限定版 ' }, label)).toBe(
      '<package> 初回限定版',
    )
    expect(editionText({ edition: null, edition_name: '豪華版' }, label)).toBe('豪華版')
    expect(editionText({ edition: 'steam', edition_name: null }, label)).toBe('<steam>')
    expect(editionText({ edition: null, edition_name: null }, label)).toBe('')
  })
})
