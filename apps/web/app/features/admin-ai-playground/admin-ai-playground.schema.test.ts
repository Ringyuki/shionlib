import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { outlineFrom, paramsForm, playgroundCommand } from './admin-ai-playground.schema'

describe('outlineFrom', () => {
  it('takes a JSON object and nothing else', () => {
    expect(outlineFrom('{"type":"object"}')).toEqual({ type: 'object' })
    expect(outlineFrom('[1,2]')).toBeUndefined()
    expect(outlineFrom('not json')).toBeUndefined()
    expect(outlineFrom('')).toBeUndefined()
  })
})

describe('paramsForm', () => {
  const rules = paramsForm(
    createFormKit(issue => issue.kind),
    kind => kind,
  )

  it('asks for a schema only when structured output is wanted', () => {
    expect(firstIssueMessage(rules, { system: '', structured: false, schema: '' })).toBeUndefined()
    expect(firstIssueMessage(rules, { system: '', structured: true, schema: 'x' })).toBe('schema')
    expect(
      firstIssueMessage(rules, { system: '', structured: true, schema: '{"type":"object"}' }),
    ).toBeUndefined()
  })
})

describe('playgroundCommand', () => {
  it('needs a target and at least one message', () => {
    const run = {
      target: { kind: 'route', id: '4' },
      messages: [{ role: 'user', content: '你好' }],
      system: '',
      temperature: null,
      maxOutputTokens: null,
      schema: null,
    }
    expect(parseOptional(playgroundCommand, run)).toEqual(run)
    expect(parseOptional(playgroundCommand, { ...run, messages: [] })).toBeUndefined()
    expect(
      parseOptional(playgroundCommand, { ...run, target: { kind: 'provider', id: '4' } }),
    ).toBeUndefined()
  })
})
