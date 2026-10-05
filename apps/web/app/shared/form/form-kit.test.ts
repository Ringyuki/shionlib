import { describe, expect, it } from 'vitest'
import { parseOptional, firstIssueMessage } from './check'
import { constraintOf, createFormKit, lengthOf, textIssue, type FieldConstraint } from './form-kit'

const text = (constraint: Partial<FieldConstraint>): FieldConstraint => ({
  type: 'string',
  required: true,
  nullable: false,
  ...constraint,
})

describe('textIssue', () => {
  it('follows the constraints the API declares', () => {
    expect(textIssue(text({}), '  ')).toEqual({ kind: 'required' })
    expect(textIssue(text({ required: false }), '')).toBeUndefined()
    expect(textIssue(text({ minLength: 2 }), '汐')).toEqual({ kind: 'minLength', min: 2 })
    expect(textIssue(text({ minLength: 2 }), '汐音')).toBeUndefined()
    expect(textIssue(text({ maxLength: 3 }), 'abcd')).toEqual({ kind: 'maxLength', max: 3 })
    expect(textIssue(text({ format: 'email' }), 'not-mail')).toEqual({
      kind: 'format',
      format: 'email',
    })
    expect(textIssue(text({ format: 'email' }), ' a@b.co ')).toBeUndefined()
    expect(textIssue(text({ format: 'date-time' }), 'whatever')).toBeUndefined()
    expect(textIssue(text({ pattern: '^[a-z]+$' }), 'ABC')).toEqual({ kind: 'pattern' })
    expect(textIssue(text({ enum: ['zh', 'en'] }), 'fr')).toEqual({ kind: 'enum' })
  })

  it('reads the generated constraints of a request body', () => {
    expect(constraintOf('RegisterUserInputBody', 'name')).toMatchObject({
      required: true,
      minLength: 2,
      maxLength: 20,
    })
    expect(lengthOf('RegisterUserInputBody', 'password')).toEqual({ min: 8, max: 50 })
  })
})

describe('createFormKit', () => {
  const kit = createFormKit(issue => issue.kind)

  it('builds text rules that report the first problem with its message', () => {
    const name = kit.text('RegisterUserInputBody', 'name')
    expect(firstIssueMessage(name, 'a')).toBe('minLength')
    expect(firstIssueMessage(name, '')).toBe('required')
    expect(parseOptional(name, 'shion')).toBe('shion')
    expect(parseOptional(name, 7)).toBeUndefined()
  })
})
