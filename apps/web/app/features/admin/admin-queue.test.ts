import { describe, expect, it } from 'vitest'
import {
  pendingTotal,
  queueLength,
  queueOf,
  unlisted,
  type Report,
  type ScanCase,
  type StalledCheck,
} from './admin-queue'

const user = { id: 1, name: 'kotori', avatar: null, is_sponsor: false }

const game = { id: 1, title_jp: 'ゲーム', title_zh: '', title_en: '' }

const scanCase = (id: number, deadline: string): ScanCase => ({
  id,
  status: 'PENDING',
  decision_source: null,
  review_note: null,
  review_deadline: deadline,
  reviewed_at: null,
  detector: 'clamscan',
  detected_viruses: ['Eicar'],
  file_name: `case-${id}.zip`,
  file_size: 1,
  file_hash: 'h',
  hash_algorithm: 'sha256',
  notify_uploader_on_allow: true,
  uploader_notified_at: null,
  created: '2026-10-01T00:00:00.000Z',
  updated: '2026-10-01T00:00:00.000Z',
  file: null,
  resource: null,
  uploader: user,
  reviewer: null,
})

const stalled = (id: number, deadline: string): StalledCheck => ({
  file_id: id,
  file_name: `stalled-${id}.7z`,
  file_size: 1,
  resource_id: 1,
  game,
  uploader: user,
  failures: 6,
  reason: 'scan service did not answer',
  uploaded: '2026-10-02T00:00:00.000Z',
  stalled_at: null,
  deadline,
})

const report = (id: number, created: string): Report => ({
  id,
  reason: 'OTHER',
  detail: null,
  status: 'PENDING',
  malicious_level: 'LOW',
  processed_at: null,
  process_note: null,
  created,
  updated: created,
  resource: { id: 1, game_id: 1, game, files: null },
  reporter: user,
  reported_user: user,
  processor: null,
})

const pending = {
  reports: 12,
  malware_cases: 1,
  stalled_files: 1,
  comments: 2,
  walkthroughs: 0,
  ai_alerts: 0,
}

const nothingHeld = { comments: [], walkthroughs: [] }

describe('queueOf', () => {
  it('puts what has a deadline first, the nearest on top, then the newest reports', () => {
    const queue = queueOf({
      cases: [scanCase(1, '2026-10-12T10:00:00.000Z')],
      stalled: [stalled(2, '2026-10-12T08:00:00.000Z')],
      reports: [report(3, '2026-10-10T00:00:00.000Z'), report(4, '2026-10-11T00:00:00.000Z')],
      ...nothingHeld,
    })
    expect(queue.map(entry => entry.key)).toEqual([
      'stalled-2',
      'malware-1',
      'report-4',
      'report-3',
    ])
    expect(queue.map(entry => entry.to)).toEqual([
      '/zh/admin/checks',
      '/zh/admin/checks?case=1',
      '/zh/admin/reports?id=4',
      '/zh/admin/reports?id=3',
    ])
  })

  it('keeps at most the first ten', () => {
    const reports = Array.from({ length: queueLength + 2 }, (_, index) =>
      report(index + 1, `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
    )
    expect(queueOf({ cases: [], stalled: [], reports, ...nothingHeld })).toHaveLength(queueLength)
  })
})

describe('unlisted', () => {
  it('names the kinds that have more waiting than the queue shows', () => {
    const queue = queueOf({
      cases: [scanCase(1, '2026-10-12T10:00:00.000Z')],
      stalled: [stalled(2, '2026-10-12T08:00:00.000Z')],
      reports: [report(3, '2026-10-10T00:00:00.000Z')],
      ...nothingHeld,
    })
    expect(unlisted(queue, pending)).toEqual([
      { kind: 'report', count: 11 },
      { kind: 'comment', count: 2 },
    ])
    expect(pendingTotal(pending)).toBe(16)
  })
})
