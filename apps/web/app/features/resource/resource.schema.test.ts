import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { blankInfo } from './resource-info'
import {
  editCommand,
  editForm,
  editValuesFrom,
  uploadForm,
  type EditValues,
  type UploadValues,
} from './resource.schema'

const kit = createFormKit(issue => issue.kind)

const issue = (name: string) => name

const edit: EditValues = {
  platform: ['win'],
  language: ['zh'],
  simulator: '',
  note: '',
  ...blankInfo,
}

const upload: UploadValues = {
  ...edit,
  translation: 'official',
  form: 'portable',
  files: [new File(['x'], 'game.7z')],
}

describe('uploadForm', () => {
  const problem = (values: UploadValues) => firstIssueMessage(uploadForm(kit, issue), values)

  it('accepts a resource that says where its translation comes from and how it is packed', () => {
    expect(problem(upload)).toBeUndefined()
  })

  it('asks for the translation, the translators and the form', () => {
    expect(problem({ ...upload, translation: '' })).toBe('translation')
    expect(problem({ ...upload, translation: 'group' })).toBe('translators')
    expect(problem({ ...upload, form: '' })).toBe('form')
    expect(problem({ ...upload, language: ['jp'], translation: '' })).toBeUndefined()
  })

  it('checks the release page and the lengths the API declares', () => {
    const machine: UploadValues = { ...upload, translation: 'machine' }
    expect(problem({ ...machine, releaseUrl: 'moyu.moe/patch/1' })).toBe('releaseUrl')
    expect(problem({ ...machine, patchVersion: 'v'.repeat(33) })).toBe('maxLength')
    expect(problem({ ...machine, editionName: '版'.repeat(65) })).toBe('maxLength')
  })
})

describe('editForm', () => {
  const problem = (values: EditValues) => firstIssueMessage(editForm(kit, issue), values)

  it('lets a resource stay without a translation or a form', () => {
    expect(problem(edit)).toBeUndefined()
  })

  it('still needs a translator for a translation by a group', () => {
    expect(problem({ ...edit, translation: 'group' })).toBe('translators')
    expect(problem({ ...edit, translation: 'group', translators: ['绿茶汉化组'] })).toBeUndefined()
  })
})

describe('editCommand', () => {
  it('carries the information of the resource', () => {
    const command = { resourceId: 3, ...edit, translation: 'group', translators: ['绿茶汉化组'] }
    expect(parseOptional(editCommand, command)).toEqual(command)
    expect(parseOptional(editCommand, { ...command, form: 'floppy' })).toBeUndefined()
  })
})

describe('editValuesFrom', () => {
  it('starts from what the resource says', () => {
    expect(
      editValuesFrom({
        platform: ['win', 'amiga'],
        language: ['zh'],
        simulator: null,
        note: null,
        translation: 'machine',
        translators: [],
        patch_version: 'v2.8',
        release_url: null,
        edition: null,
        edition_name: null,
        form: 'portable',
        extras: ['save'],
      }),
    ).toEqual({
      ...edit,
      translation: 'machine',
      patchVersion: 'v2.8',
      form: 'portable',
      extras: ['save'],
    })
  })
})
