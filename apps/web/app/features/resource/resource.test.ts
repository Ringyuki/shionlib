import { describe, expect, it } from 'vitest'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'
import {
  awaitedVolumes,
  detections,
  downloadable,
  fileState,
  reportReasons,
  resourceDraft,
  rightsOver,
  resourcePlatforms,
  shortHash,
  summarizeResources,
  withPlatform,
  type ReportReason,
  type Resource,
} from './resource'
import { blankInfo } from './resource-info'

const file: Parameters<typeof fileState>[0] = {
  stage: 'stored',
  malware_scan_cases: null,
  is_virus_false_positive: false,
}

const resource = (id: number, platform: Resource['platform']): Resource => ({
  id,
  platform,
  language: ['zh'],
  simulator: null,
  note: null,
  downloads: 0,
  creator: { id: 7, name: 'mikan', avatar: null, is_sponsor: false },
  published_at: '2026-10-01T00:00:00Z',
  created: '2026-10-01T00:00:00Z',
  updated: '2026-10-01T00:00:00Z',
  comments: 0,
  files: [],
  missing_volumes: [],
  volumes_deadline: null,
  translation: null,
  translators: [],
  patch_version: null,
  release_url: null,
  edition: null,
  edition_name: null,
  form: null,
  extras: [],
})

describe('fileState', () => {
  it('follows the stage of a file on its way to storage', () => {
    expect(fileState({ ...file, stage: 'checking' })).toBe('checking')
    expect(fileState({ ...file, stage: 'awaiting_volumes' })).toBe('awaitingVolumes')
    expect(fileState({ ...file, stage: 'storing' })).toBe('storing')
    expect(fileState({ ...file, stage: 'under_review' })).toBe('underReview')
    expect(fileState({ ...file, stage: 'stalled' })).toBe('stalled')
    expect(fileState({ ...file, stage: 'rejected' })).toBe('rejected')
  })

  it('tells stored, risky and cleared files apart', () => {
    expect(fileState(file)).toBe('passed')
    const infected = { ...file, malware_scan_cases: [{ id: 1, detected_viruses: ['Trojan.X'] }] }
    expect(fileState(infected)).toBe('risky')
    expect(fileState({ ...infected, is_virus_false_positive: true })).toBe('falsePositive')
  })

  it('names the volumes a set waits for, the first three of many', () => {
    expect(awaitedVolumes({ missing_volumes: [], volumes_deadline: null })).toBeUndefined()
    expect(awaitedVolumes({ missing_volumes: null, volumes_deadline: null })).toBeUndefined()
    const deadline = '2026-10-13T09:45:00.000Z'
    expect(
      awaitedVolumes({ missing_volumes: ['g.part2.rar'], volumes_deadline: deadline }),
    ).toEqual({ names: ['g.part2.rar'], more: 0, deadline: new Date(deadline) })
    const many = ['g.r01', 'g.r02', 'g.r03', 'g.r04', 'g.r05']
    expect(awaitedVolumes({ missing_volumes: many, volumes_deadline: deadline })).toEqual({
      names: ['g.r01', 'g.r02', 'g.r03'],
      more: 2,
      deadline: new Date(deadline),
    })
  })

  it('offers only stored files that are not blocked', () => {
    const infected = { ...file, malware_scan_cases: [{ id: 1, detected_viruses: ['Trojan.X'] }] }
    expect(downloadable(file)).toBe(true)
    expect(downloadable({ ...infected, is_virus_false_positive: true })).toBe(true)
    expect(downloadable(infected)).toBe(false)
    expect(downloadable({ ...file, stage: 'storing' })).toBe(false)
  })

  it('lists each detection once', () => {
    expect(
      detections({
        malware_scan_cases: [
          { id: 1, detected_viruses: ['A', 'B'] },
          { id: 2, detected_viruses: ['A'] },
        ],
      }),
    ).toEqual(['A', 'B'])
  })
})

describe('display helpers', () => {
  it('shortens hashes', () => {
    expect(shortHash('9f3a1c00112233445566e02b8c')).toBe('9f3a1c…e02b8c')
    expect(shortHash('abc')).toBe('abc')
  })
})

describe('platform filter', () => {
  const resources = [resource(1, ['win']), resource(2, ['swi', 'win']), resource(3, null)]

  it('offers the platforms in order of appearance', () => {
    expect(resourcePlatforms(resources)).toEqual(['win', 'swi'])
  })

  it('keeps every resource without a platform choice', () => {
    expect(withPlatform(resources, 'swi').map(entry => entry.id)).toEqual([2])
    expect(withPlatform(resources, undefined)).toHaveLength(3)
  })
})

describe('rightsOver', () => {
  it('lets the uploader and admins manage and only super admins remove', () => {
    expect(rightsOver(resource(1, null), { id: 7, role: 1 })).toEqual({
      manage: true,
      remove: false,
    })
    expect(rightsOver(resource(1, null), { id: 8, role: 1 })).toEqual({
      manage: false,
      remove: false,
    })
    expect(rightsOver(resource(1, null), { id: 8, role: 2 })).toEqual({
      manage: true,
      remove: false,
    })
    expect(rightsOver(resource(1, null), { id: 8, role: 3 })).toEqual({
      manage: true,
      remove: true,
    })
    expect(rightsOver(resource(1, null), null)).toEqual({ manage: false, remove: false })
  })
})

describe('report reasons', () => {
  it('offers the most common reason first', () => {
    expect(reportReasons[0]).toBe('BROKEN_LINK')
    expect(new Set(reportReasons).size).toBe(reportReasons.length)
  })

  it('names every reason the API accepts in each locale', () => {
    const tables: Record<ReportReason, string>[] = [zh.reason, en.reason, ja.reason]
    expect(tables.every(table => reportReasons.every(reason => (table[reason] ?? '') !== ''))).toBe(
      true,
    )
  })
})

describe('resourceDraft', () => {
  const values: Parameters<typeof resourceDraft>[0] = {
    platform: ['and'],
    language: ['zh'],
    simulator: 'KRKR',
    note: ' 模拟器选择 data.xp3 ',
    ...blankInfo,
    translation: 'official',
    form: 'portable',
  }

  it('is what creating the resource sends, without the files', () => {
    expect(resourceDraft(values)).toEqual({
      platform: ['and'],
      language: ['zh'],
      simulator: 'KRKR',
      note: '模拟器选择 data.xp3',
      translation: 'official',
      form: 'portable',
      extras: [],
    })
  })

  it('cannot be made before the form is chosen', () => {
    expect(resourceDraft({ ...values, form: '' })).toBeUndefined()
  })
})

describe('summarizeResources', () => {
  it('adds up downloads and finds the latest update', () => {
    const older = { ...resource(1, ['win']), downloads: 3, updated: '2026-09-01T00:00:00Z' }
    const newer = { ...resource(2, ['swi']), downloads: 4, updated: '2026-10-01T00:00:00Z' }
    expect(summarizeResources([older, newer])).toEqual({
      count: 2,
      downloads: 7,
      updated: '2026-10-01T00:00:00Z',
      first: 1,
    })
    expect(summarizeResources([])).toEqual({
      count: 0,
      downloads: 0,
      updated: undefined,
      first: undefined,
    })
  })
})
