import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { base, composition } from './resource-composition-testing'
import type { CompositionEdit } from './resource-composition.schema'
import {
  loadComposer,
  loadOwnCompositions,
  runCompositionCommand,
} from './resource-composition.use-cases'

const paths = (requests: readonly Request[]) =>
  requests.map(request => `${request.method} ${new URL(request.url).pathname}`)

const bodies = async (requests: readonly Request[]) =>
  Promise.all(requests.map(request => (request.body === null ? null : request.clone().json())))

describe('loadComposer', () => {
  it('reads the draft, then the originals of its game', async () => {
    const disc = base(2, { form: 'disc', reason: 'disc' })
    const fake = fakeApi()
      .on('get', '/composition/{id}', composition())
      .on('get', '/game/{gameId}/composition/bases', [disc, base(31)])
    await expect(
      loadComposer(fake.api, { gameId: 99, compositionId: 4, step: 'files' }),
    ).resolves.toEqual({ composition: composition(), bases: [base(31), disc], step: 'files' })
    expect(paths(fake.requests)).toEqual(['GET /composition/4', 'GET /game/10/composition/bases'])
  })

  it('starts over when the draft is gone and asks nothing without a game', async () => {
    const fake = fakeApi().fail('get', '/composition/{id}', 404, {
      code: 660101,
      message: 'gone',
    })
    await expect(loadComposer(fake.api, { gameId: undefined, compositionId: 4 })).resolves.toEqual({
      composition: null,
      bases: [],
      step: 'base',
    })
    expect(paths(fake.requests)).toEqual(['GET /composition/4'])
  })
})

describe('runCompositionCommand', () => {
  it('replaces the draft of another original', async () => {
    const fake = fakeApi()
      .on('delete', '/composition/{id}', undefined)
      .on('post', '/game/{gameId}/composition', composition({ id: 5 }))
    await runCompositionCommand(fake.api, {
      intent: 'begin',
      gameId: 10,
      baseResourceId: 31,
      replacing: 4,
    })
    expect(paths(fake.requests)).toEqual(['DELETE /composition/4', 'POST /game/10/composition'])
    expect((await bodies(fake.requests))[1]).toEqual({ base_resource_id: 31 })
  })

  it('sends only what the translation keeps', async () => {
    const fake = fakeApi().on('patch', '/composition/{id}', composition())
    const edit: Omit<CompositionEdit, 'translation'> = {
      intent: 'edit',
      compositionId: 4,
      language: ['zh'],
      translators: ['绿茶汉化组'],
      patchVersion: ' v1.1 ',
      releaseUrl: '',
      keepPatch: false,
    }
    await runCompositionCommand(fake.api, { ...edit, translation: 'official', patchDir: '' })
    await runCompositionCommand(fake.api, { ...edit, translation: 'group' })
    expect(await bodies(fake.requests)).toEqual([
      {
        language: ['zh'],
        translation: 'official',
        translators: [],
        keep_patch: false,
        patch_dir: '',
      },
      {
        language: ['zh'],
        translation: 'group',
        translators: ['绿茶汉化组'],
        patch_version: 'v1.1',
        release_url: '',
        keep_patch: false,
      },
    ])
  })

  it('starts, retries, discards and takes an input out', async () => {
    const fake = fakeApi()
      .on('post', '/composition/{id}/start', composition({ state: 'queued' }))
      .on('post', '/composition/{id}/retry', composition({ state: 'queued' }))
      .on('delete', '/composition/{id}', undefined)
      .on('delete', '/composition/{id}/save', composition())
    for (const intent of ['start', 'retry', 'discard'] as const) {
      await runCompositionCommand(fake.api, { intent, compositionId: 4 })
    }
    await runCompositionCommand(fake.api, { intent: 'detach', compositionId: 4, role: 'save' })
    expect(paths(fake.requests)).toEqual([
      'POST /composition/4/start',
      'POST /composition/4/retry',
      'DELETE /composition/4',
      'DELETE /composition/4/save',
    ])
  })
})

describe('loadOwnCompositions', () => {
  it('lists none for a guest', async () => {
    const fake = fakeApi().fail('get', '/composition/mine', 401, { code: 200101, message: 'no' })
    await expect(loadOwnCompositions(fake.api)).resolves.toEqual([])
  })
})
