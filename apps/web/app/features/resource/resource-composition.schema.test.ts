import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { blankDetails, type DetailValues } from './resource-composition'
import {
  composeQueryFrom,
  compositionCommand,
  detailsForm,
  updatePatchForm,
} from './resource-composition.schema'

const kit = createFormKit(issue => issue.kind)

const issue = (name: string) => name

describe('composeQueryFrom', () => {
  it('reads the mode, the draft and the step of the upload page', () => {
    const query = (raw: string) => composeQueryFrom(new URLSearchParams(raw))
    expect(query('mode=compose&composition=4&step=files')).toEqual({
      mode: 'compose',
      compositionId: 4,
      step: 'files',
    })
    expect(query('mode=other&composition=x&step=done')).toEqual({
      mode: 'upload',
      compositionId: undefined,
      step: undefined,
    })
  })
})

describe('compositionCommand', () => {
  it('takes no translation that a patch cannot have', () => {
    const edit = {
      intent: 'edit',
      compositionId: 4,
      language: ['zh'],
      translators: [],
      patchVersion: '',
      releaseUrl: '',
      keepPatch: true,
    }
    expect(parseOptional(compositionCommand, { ...edit, translation: 'group' })).toBeDefined()
    expect(parseOptional(compositionCommand, { ...edit, translation: 'none' })).toBeUndefined()
    expect(
      parseOptional(compositionCommand, { intent: 'detach', compositionId: 4, role: 'base' }),
    ).toBeUndefined()
  })
})

describe('detailsForm', () => {
  const problem = (values: DetailValues) => firstIssueMessage(detailsForm(kit, issue), values)

  it('asks for the language, the translation and its group', () => {
    expect(problem(blankDetails)).toBe('languages')
    expect(problem({ ...blankDetails, language: ['zh'] })).toBe('translation')
    expect(problem({ ...blankDetails, language: ['zh'], translation: 'group' })).toBe('translators')
    expect(
      problem({ ...blankDetails, language: ['zh'], translation: 'group', translators: ['A'] }),
    ).toBeUndefined()
  })
})

describe('updatePatchForm', () => {
  it('needs the new patch', () => {
    const form = updatePatchForm(kit, issue)
    expect(firstIssueMessage(form, { files: [], patchVersion: '', note: '' })).toBe('files')
    const patch = new File(['x'], 'patch.7z')
    expect(
      firstIssueMessage(form, { files: [patch], patchVersion: 'v1.2', note: '' }),
    ).toBeUndefined()
  })
})
