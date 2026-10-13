import { describe, expect, it } from 'vitest'
import {
  blankDetails,
  changesOf,
  detailValuesFrom,
  dirChoices,
  inputPhase,
  matchedValues,
  onlyDiscs,
  reachedStep,
  runningStep,
  runStatus,
  startable,
  stepReady,
  unlistedChanges,
  usableFirst,
} from './resource-composition'
import { base, composition, input, plan, runSteps } from './resource-composition-testing'

describe('the steps of the wizard', () => {
  it('goes no further than the draft allows', () => {
    expect(reachedStep(undefined, null)).toBe('base')
    expect(reachedStep('extras', null)).toBe('base')
    expect(reachedStep(undefined, composition())).toBe('patch')
    expect(reachedStep('files', composition({ patch: null }))).toBe('patch')
    const reading = composition({ patch: input({ state: 'reading' }) })
    expect(reachedStep('extras', reading)).toBe('files')
    expect(reachedStep('extras', composition())).toBe('extras')
    expect(reachedStep('base', composition())).toBe('base')
  })

  it('moves on only with what the step needs', () => {
    const idle = { name: 'empty' } as const
    expect(stepReady('base', null, undefined, idle, idle)).toBe(false)
    expect(stepReady('base', null, 31, idle, idle)).toBe(true)
    expect(stepReady('patch', composition(), 31, idle, idle)).toBe(false)
    expect(stepReady('patch', composition(), 31, { name: 'uploading', percent: 4 }, idle)).toBe(
      true,
    )
    expect(stepReady('patch', composition(), 31, { name: 'failed' }, idle)).toBe(false)
    expect(stepReady('files', composition(), 31, idle, idle)).toBe(true)
    const conflicted = composition({ plan: plan({ conflicts: ['data/a.xp3'] }) })
    expect(stepReady('files', conflicted, 31, idle, idle)).toBe(false)
    const empty = composition({
      plan: plan({ adds: { files: 0, size: 0 }, replaces: { files: 0, size: 0 } }),
    })
    expect(stepReady('files', empty, 31, idle, idle)).toBe(false)
    expect(stepReady('extras', composition(), 31, idle, { name: 'uploading', percent: 2 })).toBe(
      false,
    )
  })

  it('starts only with a read save and a language', () => {
    expect(startable(composition())).toBe(true)
    const reading = input({ name: 'save.zip', state: 'reading' })
    expect(startable(composition({ save: reading }))).toBe(false)
    expect(startable(composition({ details: { ...composition().details, language: [] } }))).toBe(
      false,
    )
  })
})

describe('an input of a composition', () => {
  it('is shown by its upload first and by the server afterwards', () => {
    const read = input()
    expect(inputPhase(null)).toEqual({ name: 'empty' })
    const sending = { name: 'p.zip', size: 9, percent: 40, failed: false }
    expect(inputPhase(read, sending)).toEqual({ name: 'uploading', percent: 40 })
    expect(inputPhase(null, { ...sending, failed: true })).toEqual({ name: 'failed' })
    expect(inputPhase(read)).toEqual({ name: 'ready', input: read })
  })
})

describe('the plan', () => {
  it('lists what changes by path and counts what is left out', () => {
    expect(changesOf(plan()).map(change => [change.path, change.oldSize])).toEqual([
      ['game_chs.exe', null],
      ['patch.xp3', 121],
    ])
    expect(unlistedChanges(plan({ adds: { files: 250, size: 1 } }))).toBe(249)
    expect(dirChoices(plan().patch_dirs)).toEqual([
      { path: '', items: 1, depth: 0 },
      { path: '汉化补丁 v1.1', items: 2, depth: 1 },
    ])
  })
})

describe('the run', () => {
  it('says where it is', () => {
    const steps = runSteps().map((step, index) => ({
      ...step,
      state: index < 3 ? ('done' as const) : index === 3 ? ('running' as const) : step.state,
    }))
    const running = composition({ state: 'running', step: 'pack', steps })
    expect(runStatus(running)).toBe('running')
    expect(runningStep(running)).toEqual({ at: 4, total: 6, step: 'pack' })
    expect(runStatus(composition())).toBeUndefined()
    expect(runStatus(composition({ state: 'done' }))).toBeUndefined()
  })
})

describe('originals', () => {
  it('lists the usable ones first and tells when only disc images exist', () => {
    const disc = base(2, { form: 'disc', reason: 'disc' })
    expect(usableFirst([disc, base(3)]).map(found => found.resource_id)).toEqual([3, 2])
    expect(onlyDiscs([disc])).toBe(true)
    expect(onlyDiscs([disc, base(3)])).toBe(false)
    expect(onlyDiscs([])).toBe(false)
  })
})

describe('the details of a patch', () => {
  const match = {
    translators: ['枫笛汉化组'],
    version: 'V1.04',
    url: 'https://www.moyu.moe/resource/6280',
  }

  it('are filled from the patch site only where nothing was written', () => {
    expect(matchedValues(blankDetails, match)).toMatchObject({
      translation: 'group',
      translators: ['枫笛汉化组'],
      patchVersion: 'V1.04',
      releaseUrl: 'https://www.moyu.moe/resource/6280',
    })
    const written = { ...blankDetails, translators: ['A'], releaseUrl: 'https://a.example' }
    expect(matchedValues(written, match)).toBeUndefined()
    expect(matchedValues(blankDetails, null)).toBeUndefined()
  })

  it('start from what the draft holds', () => {
    expect(detailValuesFrom(composition().details)).toMatchObject({
      language: ['zh'],
      translation: 'group',
      translators: ['绿茶汉化组'],
      patchVersion: 'v1.1',
      releaseUrl: '',
      form: 'portable',
    })
  })
})
