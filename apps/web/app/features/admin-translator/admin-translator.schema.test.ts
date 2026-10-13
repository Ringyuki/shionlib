import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { mostAliases } from './admin-translator'
import {
  editForm,
  editValuesFrom,
  filterFrom,
  mergeForm,
  translatorCommand,
} from './admin-translator.schema'

const kit = createFormKit(issue => issue.kind)

const issue = (name: string) => name

describe('filterFrom', () => {
  it('reads the view, the search and the order', () => {
    expect(filterFrom(new URLSearchParams('view=duplicates&q=%20tea%20&sort=latest'), 2)).toEqual({
      view: 'duplicates',
      query: 'tea',
      sort: 'latest',
      page: 2,
    })
  })

  it('falls back to every translator, most works first', () => {
    expect(filterFrom(new URLSearchParams('view=trash&sort=random'), 1)).toEqual({
      view: 'all',
      query: '',
      sort: 'works',
      page: 1,
    })
  })
})

describe('translatorCommand', () => {
  it('reads a change by its action', () => {
    const edit = { action: 'edit', id: 3, name: '绿茶汉化组', aliases: ['Green Tea'], homepage: '' }
    expect(parseOptional(translatorCommand, edit)).toEqual(edit)
    const merge = { action: 'merge', id: 3, mergedIds: [4, 9] }
    expect(parseOptional(translatorCommand, merge)).toEqual(merge)
    expect(parseOptional(translatorCommand, { action: 'dismiss', ids: [3, 4] })).toEqual({
      action: 'dismiss',
      ids: [3, 4],
    })
    expect(
      parseOptional(translatorCommand, { action: 'merge', id: 0, mergedIds: [] }),
    ).toBeUndefined()
    expect(parseOptional(translatorCommand, { action: 'remove', id: 3 })).toBeUndefined()
  })
})

describe('editForm', () => {
  const values = { name: '绿茶汉化组', aliases: ['Green Tea'], homepage: '' }
  const problem = (changed: Partial<typeof values>) =>
    firstIssueMessage(editForm(kit, issue), { ...values, ...changed })

  it('needs a name and takes a homepage or none', () => {
    expect(problem({})).toBeUndefined()
    expect(problem({ homepage: 'https://example.org/' })).toBeUndefined()
    expect(problem({ name: ' ' })).toBe('name')
    expect(problem({ name: '绿'.repeat(65) })).toBe('maxLength')
  })

  it('limits the aliases', () => {
    const many = Array.from({ length: mostAliases + 1 }, (_, index) => `别名 ${index}`)
    expect(problem({ aliases: many })).toBe('tooManyAliases')
  })

  it('starts from what the translator has', () => {
    expect(editValuesFrom({ name: '绿茶汉化组', aliases: null, homepage: null })).toEqual({
      name: '绿茶汉化组',
      aliases: [],
      homepage: '',
    })
  })
})

describe('mergeForm', () => {
  it('needs the name that is kept', () => {
    expect(firstIssueMessage(mergeForm(issue), { keep: null })).toBe('keep')
    expect(firstIssueMessage(mergeForm(issue), { keep: 3 })).toBeUndefined()
  })
})
