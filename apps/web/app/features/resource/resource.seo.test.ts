import { describe, expect, it } from 'vitest'
import type { GameHeader } from '~/features/game'
import { messages } from '~/messages/zh'
import type { Resource } from './resource'
import type { ResourcePage } from './resource-page'
import { resourceHead } from './resource.seo'

const file = (
  stage: NonNullable<Resource['files']>[number]['stage'],
): NonNullable<Resource['files']>[number] => ({
  id: 1,
  type: 1,
  file_name: 'game.7z',
  original_name: null,
  canonical_name: true,
  file_size: 9205871997,
  file_url: null,
  s3_file_key: null,
  hash_algorithm: 'blake3',
  file_hash: 'a'.repeat(64),
  file_status: 3,
  stage,
  rejection: null,
  is_virus_false_positive: false,
  malware_scan_cases: null,
  creator: { id: 1, name: 'ringyuki', avatar: null, is_sponsor: true },
  latest_history: null,
  uploaded: '2026-05-15T12:10:53Z',
  sha256: null,
  inspection_id: null,
})

const resource: Resource = {
  id: 8046,
  platform: ['win'],
  language: ['zh'],
  simulator: null,
  downloads: 1886,
  creator: { id: 1, name: 'ringyuki', avatar: null, is_sponsor: true },
  published_at: '2026-05-15T12:07:54Z',
  created: '2026-05-15T12:07:54Z',
  updated: '2026-05-15T12:07:54Z',
  comments: 0,
  files: [file('stored')],
  missing_volumes: [],
  volumes_deadline: null,
  translation: 'group',
  translators: [
    { id: 1, name: 'Can/need' },
    { id: 2, name: '破琵琶生产公社汉化组' },
  ],
  patch_version: null,
  release_url: null,
  edition: null,
  edition_name: null,
  form: 'portable',
  extras: [],
  canonical_name: true,
}

const game: GameHeader = {
  id: 962,
  v_id: null,
  b_id: null,
  h_id: null,
  extra_info: [],
  title_jp: 'ライムライト・レモネードジャム',
  title_zh: '橘光柠水随想曲',
  title_en: '',
  aliases: [],
  covers: [],
  developers: [],
  release_date: null,
  release_date_tba: false,
  type: null,
  platform: [],
  content_limit: 0,
}

const page = (shown: Resource): ResourcePage => ({
  resource: shown,
  game,
  inspections: [],
  lineage: { current: null, latest: null },
})

const texts = { locale: 'zh' as const, messages }

describe('resourceHead', () => {
  it('names the game, platforms and languages and says it can be downloaded', () => {
    const head = resourceHead(page(resource), texts)
    expect(head.title).toBe('橘光柠水随想曲 Windows 简中 下载')
    expect(head.description).toBe(
      '《橘光柠水随想曲》的资源，平台为 Windows，语言为简中。由 Can/need和破琵琶生产公社汉化组 翻译。形态为免安装。共 1 个文件，8.57 GB。',
    )
    expect(head.indexable).toBe(true)
  })

  it('leaves out the download until a file can be downloaded, and keeps tabs out of search', () => {
    expect(resourceHead(page({ ...resource, files: [file('checking')] }), texts).title).toBe(
      '橘光柠水随想曲 Windows 简中',
    )
    const history = resourceHead(page(resource), texts, 'history')
    expect(history.title).toBe('橘光柠水随想曲 Windows 简中 下载 变更历史')
    expect(history.indexable).toBe(false)
  })
})
