import { describe, expect, it } from 'vitest'
import { blankInfo } from './resource-info'
import {
  filledFrom,
  nameBody,
  previewable,
  uploadedName,
  type NameQuery,
  type NameReading,
} from './resource-name'

const query: NameQuery = {
  ...blankInfo,
  gameId: 10,
  fileName: 'upload.part1.rar',
  language: ['zh'],
  translation: 'group',
  translators: ['绿茶汉化组'],
  patchVersion: ' v1.1 ',
  releaseUrl: 'https://example.org/patch',
  edition: 'download',
  editionName: '初回限定版',
  form: 'portable',
  extras: ['save'],
}

const nothing: NameReading = {
  translation: null,
  translators: [],
  patch_version: null,
  edition: null,
  edition_name: null,
  form: null,
}

describe('nameBody', () => {
  it('sends what the name is made of and nothing else', () => {
    expect(nameBody(query)).toEqual({
      language: ['zh'],
      file_name: 'upload.part1.rar',
      translation: 'group',
      translators: ['绿茶汉化组'],
      patch_version: 'v1.1',
      edition: 'download',
      edition_name: '初回限定版',
      form: 'portable',
    })
  })

  it('names the first file of a resource and leaves out what is not said', () => {
    const first: NameQuery = {
      ...blankInfo,
      gameId: 10,
      resourceId: 7,
      fileName: '',
      language: ['jp'],
    }
    expect(nameBody(first)).toEqual({ language: ['jp'], file_name: '', resource_id: 7 })
  })

  it('needs a language before a name can be shown', () => {
    expect(previewable(query)).toBe(true)
    expect(previewable({ language: [] })).toBe(false)
  })
})

describe('filledFrom', () => {
  const read: NameReading = {
    translation: 'group',
    translators: ['Can/need汉化组', '破琵琶生产公社汉化组'],
    patch_version: 'v1.1',
    edition: 'package',
    edition_name: '初回限定版',
    form: 'disc',
  }

  it('fills what the name of the file says into the fields that are still blank', () => {
    expect(filledFrom(blankInfo, read)).toEqual({
      translation: 'group',
      translators: ['Can/need汉化组', '破琵琶生产公社汉化组'],
      patchVersion: 'v1.1',
      edition: 'package',
      editionName: '初回限定版',
      form: 'disc',
    })
  })

  it('leaves what was already chosen', () => {
    expect(filledFrom(query, read)).toEqual({})
    expect(filledFrom({ ...blankInfo, form: 'portable' }, read)).not.toHaveProperty('form')
  })

  it('fills nothing from a name that says nothing', () => {
    expect(filledFrom(blankInfo, nothing)).toEqual({})
    expect(filledFrom(blankInfo, { ...nothing, translators: null })).toEqual({})
  })
})

describe('uploadedName', () => {
  it('is told only when it differs from the name the file has now', () => {
    expect(uploadedName({ file_name: '规范.7z', original_name: 'upload.7z' })).toBe('upload.7z')
    expect(uploadedName({ file_name: 'upload.7z', original_name: 'upload.7z' })).toBeUndefined()
    expect(uploadedName({ file_name: 'old.7z', original_name: null })).toBeUndefined()
  })
})
