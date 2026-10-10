import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { activityPath, categoryOf, happeningsOf, searchOfKind, type Activity } from './activity'
import { feedKindFrom } from './activity.schema'

const game: Schema<'GameCardDTO'> = {
  id: 7,
  title_jp: 'タイトル',
  title_zh: '标题',
  title_en: '',
  aliases: null,
  type: null,
  covers: null,
  intro_jp: '',
  intro_zh: '',
  intro_en: '',
  release_date: null,
  developers: null,
  resources: { count: 1, downloads: 0, platforms: null, languages: null, latest: null },
  tags: null,
}

const user = (id: number) => ({ id, name: `user${id}`, avatar: null, is_sponsor: false })

const activity = (id: number, change: Partial<Activity>): Activity => ({
  id,
  type: 'COMMENT',
  user: user(1),
  game,
  walkthrough: null,
  comment: null,
  file: null,
  created: '2026-10-09T00:00:00Z',
  updated: '2026-10-09T00:00:00Z',
  ...change,
})

const stored = (id: number, fileId: number, resourceId: number, userId = 1) =>
  activity(id, {
    type: 'FILE_UPLOAD_TO_S3',
    user: user(userId),
    file: { id: fileId, resource_id: resourceId, file_name: `part${fileId}.rar`, file_size: 10 },
  })

describe('happeningsOf', () => {
  it('says what happened and where it leads', () => {
    expect(
      happeningsOf([
        stored(3, 11, 5),
        activity(2, { comment: { id: 9, text: '好' } }),
        activity(1, { type: 'WALKTHROUGH_CREATE', walkthrough: { id: 4, title: '全线攻略' } }),
      ]),
    ).toMatchObject([
      { id: 3, kind: 'resources', resourceId: 5, files: [{ id: 11 }] },
      { id: 2, kind: 'comments', commentId: 9 },
      { id: 1, kind: 'walkthroughs', walkthroughId: 4, guide: '全线攻略' },
    ])
  })

  it('tells the files of one resource as one upload', () => {
    const happenings = happeningsOf([stored(4, 13, 5), stored(3, 12, 5), stored(2, 11, 5)])
    expect(happenings).toHaveLength(1)
    expect(happenings[0]).toMatchObject({ id: 4, files: [{ id: 13 }, { id: 12 }, { id: 11 }] })
  })

  it('keeps uploads apart when the resource or the uploader differs or something came between', () => {
    expect(happeningsOf([stored(3, 12, 5), stored(2, 11, 6)])).toHaveLength(2)
    expect(happeningsOf([stored(3, 12, 5, 1), stored(2, 11, 5, 2)])).toHaveLength(2)
    expect(
      happeningsOf([
        stored(3, 12, 5),
        activity(2, { comment: { id: 9, text: '好' } }),
        stored(1, 11, 5),
      ]),
    ).toHaveLength(3)
  })

  it('leaves out what has lost its subject', () => {
    expect(
      happeningsOf([
        activity(1, { game: null, comment: { id: 9, text: '好' } }),
        activity(2, {}),
        activity(3, { type: 'FILE_UPLOAD_TO_S3' }),
        activity(4, { type: 'WALKTHROUGH_CREATE' }),
      ]),
    ).toEqual([])
  })
})

describe('kinds', () => {
  it('asks the API for one kind, or for everything', () => {
    expect(categoryOf('all')).toBeUndefined()
    expect(categoryOf('resources')).toBe('files')
    expect(categoryOf('walkthroughs')).toBe('walkthroughCreates')
  })

  it('keeps the kind in the address and starts again at the first page', () => {
    expect(activityPath('zh')).toBe('/zh/activity')
    expect(searchOfKind('?page=4', 'comments')).toBe('?kind=comments')
    expect(searchOfKind('?kind=comments&page=2', 'all')).toBe('')
  })

  it('reads the kind and falls back on everything', () => {
    expect(feedKindFrom('resources')).toBe('resources')
    expect(feedKindFrom('edits')).toBe('all')
    expect(feedKindFrom(null)).toBe('all')
  })
})
