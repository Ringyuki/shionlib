import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import {
  ordinalFrom,
  refusedFrom,
  routeErrors,
  routeForm,
  routeLimits,
  walkthroughRemovalCommand,
  walkthroughSaveCommand,
  type RouteValues,
} from './walkthrough.schema'

const kit = createFormKit(issue => issue.kind)

function errors(values: Partial<RouteValues>, publishing = false) {
  const form = routeForm(kit, issue => issue.kind, publishing)
  return routeErrors(form, {
    characters: [],
    name: 'むぎ',
    condition: '',
    steps: '左',
    ending: '',
    ...values,
  })
}

describe('commands', () => {
  const routes = [
    {
      key: 'a',
      name: 'むぎ',
      characters: [7],
      requires: [],
      condition: '',
      ending: '',
      steps: [{ kind: 'save', text: '', remark: '', slot: '01' }],
    },
  ]

  it('reads a walkthrough to save, with or without a note', () => {
    const save = { gameId: 7, routes, publish: true }
    expect(parseOptional(walkthroughSaveCommand, save)).toEqual(save)
    const note = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(parseOptional(walkthroughSaveCommand, { ...save, note })?.note).toEqual(note)
  })

  it('refuses what is not a walkthrough', () => {
    expect(parseOptional(walkthroughSaveCommand, { gameId: 7, publish: true })).toBeUndefined()
    const jumped = [{ ...routes[0], steps: [{ kind: 'jump', text: '', remark: '', slot: '' }] }]
    expect(
      parseOptional(walkthroughSaveCommand, { gameId: 7, routes: jumped, publish: false }),
    ).toBeUndefined()
    expect(parseOptional(walkthroughRemovalCommand, { walkthroughId: 0 })).toBeUndefined()
    expect(parseOptional(walkthroughRemovalCommand, { walkthroughId: 3 })).toEqual({
      walkthroughId: 3,
    })
  })
})

describe('routeErrors', () => {
  it('lets a draft be unfinished', () => {
    expect(errors({ name: '', steps: '' })).toEqual({})
  })

  it('asks for a name and a step before publishing', () => {
    expect(errors({ name: ' ', steps: '\n\n' }, true)).toEqual({ name: 'name', steps: 'steps' })
    expect(errors({}, true)).toEqual({})
  })

  it('holds every field to what the API takes', () => {
    expect(errors({ name: 'n'.repeat(81) })).toEqual({ name: 'maxLength' })
    expect(errors({ condition: 'c'.repeat(301) })).toEqual({ condition: 'maxLength' })
    expect(errors({ ending: 'e'.repeat(101) })).toEqual({ ending: 'maxLength' })
    expect(errors({ characters: Array.from({ length: 13 }, (_, id) => id + 1) })).toEqual({
      characters: 'tooManyCharacters',
    })
  })

  it('names the line that is too long', () => {
    const long = `左\n${'x'.repeat(routeLimits.text + 1)}`
    const form = routeForm(kit, issue => JSON.stringify(issue), false)
    const values = { characters: [], name: 'a', condition: '', ending: '' }
    expect(routeErrors(form, { ...values, steps: long })).toEqual({
      steps: JSON.stringify({ kind: 'line', line: 2, max: routeLimits.text }),
    })
    const remarked = `左 | ${'x'.repeat(routeLimits.remark + 1)}`
    expect(routeErrors(form, { ...values, steps: remarked })).toEqual({
      steps: JSON.stringify({ kind: 'remark', line: 1, max: routeLimits.remark }),
    })
    const many = Array.from({ length: routeLimits.steps + 1 }, () => '左').join('\n')
    expect(routeErrors(form, { ...values, steps: many })).toEqual({
      steps: JSON.stringify({ kind: 'tooManySteps', max: routeLimits.steps }),
    })
  })
})

describe('ordinalFrom', () => {
  it('reads the place of a route from the address', () => {
    expect(ordinalFrom('3')).toBe(3)
    expect(ordinalFrom(null)).toBeUndefined()
    expect(ordinalFrom('0')).toBeUndefined()
    expect(ordinalFrom('two')).toBeUndefined()
  })
})

describe('refusedFrom', () => {
  it('finds the part a refusal of the API is about', () => {
    expect(refusedFrom({ note: 'too long' })).toEqual({ part: 'note', message: 'too long' })
    expect(refusedFrom({ 'routes[2].name': 'too long' })).toEqual({
      part: 2,
      errors: { name: 'too long' },
    })
    expect(refusedFrom({ 'routes[0].steps[4].text': 'too long' })).toEqual({
      part: 0,
      errors: { steps: 'too long' },
    })
    expect(refusedFrom({ 'routes[1].key': 'twice' })).toEqual({
      part: 1,
      errors: { steps: 'twice' },
    })
    expect(refusedFrom({ status: 'unknown' })).toBeUndefined()
    expect(refusedFrom({})).toBeUndefined()
  })
})
