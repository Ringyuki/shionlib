import type { Composition, CompositionBase, CompositionPlan } from './resource-composition'

export function plan(changes: Partial<CompositionPlan> = {}): CompositionPlan {
  return {
    game_dir: 'ライムライト',
    patch_dir: '汉化补丁 v1.1',
    game_dirs: [
      { path: '', items: 1 },
      { path: 'ライムライト', items: 3 },
    ],
    patch_dirs: [
      { path: '', items: 1 },
      { path: '汉化补丁 v1.1', items: 2 },
    ],
    added: [{ path: 'game_chs.exe', size: 942, old_size: null }],
    replaced: [{ path: 'patch.xp3', size: 146, old_size: 121 }],
    conflicts: [],
    adds: { files: 1, size: 942 },
    replaces: { files: 1, size: 146 },
    unchanged: { files: 2, size: 5900 },
    total: { files: 4, size: 6988 },
    ...changes,
  }
}

export function input(
  changes: Partial<NonNullable<Composition['patch']>> = {},
): NonNullable<Composition['patch']> {
  return {
    name: 'patch.zip',
    size: 850,
    state: 'ready',
    refusal: null,
    viruses: [],
    files: 2,
    unpacked: 1088,
    ...changes,
  }
}

export function runSteps(): NonNullable<Composition['steps']> {
  return (['fetch', 'unpack', 'apply', 'pack', 'check', 'store'] as const).map(step => ({
    step,
    state: 'waiting',
    seconds: null,
  }))
}

export function composition(changes: Partial<Composition> = {}): Composition {
  return {
    id: 4,
    game_id: 10,
    resource_id: null,
    rebuild: false,
    state: 'draft',
    base: { resource_id: 31, name: 'base (files).7z', size: 6500 },
    patch: input(),
    save: null,
    details: {
      language: ['zh'],
      translation: 'group',
      translators: ['绿茶汉化组'],
      patch_version: 'v1.1',
      release_url: null,
    },
    keep_patch: true,
    note: null,
    match: null,
    plan: plan(),
    folders: [],
    file_name: 'game [绿茶汉化组][v1.1] (files).7z',
    estimated_size: 8200,
    size: null,
    ahead: 0,
    step: null,
    percent: 0,
    steps: runSteps(),
    failure: null,
    failure_detail: null,
    queued_at: null,
    started_at: null,
    finished_at: null,
    updated: '2026-10-13T12:00:00.000Z',
    discard_at: '2026-10-14T12:00:00.000Z',
    ...changes,
  }
}

export function base(id: number, changes: Partial<CompositionBase> = {}): CompositionBase {
  return {
    resource_id: id,
    name: `base-${id} (files).7z`,
    size: 6500,
    language: ['jp'],
    edition: 'download',
    edition_name: null,
    form: 'portable',
    creator: { id: 9, name: 'ringyuki', avatar: null, is_sponsor: false },
    downloads: 12,
    reason: null,
    ...changes,
  }
}
