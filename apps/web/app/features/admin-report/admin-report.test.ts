import { describe, expect, it } from 'vitest'
import {
  checkNote,
  defaultLevel,
  falseOutlook,
  freezeDays,
  narrowed,
  penaltyOf,
  searchOf,
  searchWith,
  type Policy,
} from './admin-report'

const policy: Policy = {
  levels: [
    { level: 'LOW', penalty: { ban_days: 0, violation: false }, reasons: ['BROKEN_LINK'] },
    {
      level: 'MEDIUM',
      penalty: { ban_days: 0, violation: true },
      reasons: ['IRRELEVANT', 'OTHER'],
    },
    { level: 'HIGH', penalty: { ban_days: 7, violation: true }, reasons: ['MISLEADING_CONTENT'] },
    { level: 'CRITICAL', penalty: { ban_days: 30, violation: true }, reasons: ['MALWARE'] },
  ],
  false_report_steps: [
    { count: 8, ban_days: 14 },
    { count: 5, ban_days: 3 },
  ],
  false_report_window_days: 30,
  violation_freeze_seconds: 30 * 24 * 60 * 60,
}

const everyone = { reporter: undefined, uploader: undefined }

describe('the address of a list', () => {
  it('leaves out what is already the default', () => {
    expect(searchOf({ ...everyone, status: 'PENDING', reason: undefined })).toBe('')
    expect(searchOf({ ...everyone, status: 'ALL', reason: 'MALWARE' })).toBe(
      '?status=ALL&reason=MALWARE',
    )
    expect(searchOf({ ...everyone, status: 'VALID', reason: undefined }, 4)).toBe(
      '?status=VALID&id=4',
    )
    expect(searchOf({ status: 'ALL', reason: undefined, reporter: 7, uploader: 9 })).toBe(
      '?status=ALL&reporter=7&uploader=9',
    )
  })

  it('opens and closes a report without touching the filters', () => {
    expect(searchWith('?status=ALL&page=2', 9)).toBe('?status=ALL&page=2&id=9')
    expect(searchWith('?status=ALL&id=9', undefined)).toBe('?status=ALL')
  })

  it('knows when a list has been narrowed', () => {
    expect(narrowed({ ...everyone, status: 'PENDING', reason: undefined })).toBe(false)
    expect(narrowed({ ...everyone, status: 'PENDING', reason: 'OTHER' })).toBe(true)
    expect(narrowed({ ...everyone, status: 'ALL', reason: undefined })).toBe(true)
    expect(
      narrowed({ status: 'PENDING', reason: undefined, reporter: 7, uploader: undefined }),
    ).toBe(true)
  })
})

describe('what a verdict does', () => {
  it('starts from the level the reason usually deserves', () => {
    expect(defaultLevel(policy, 'MALWARE')).toBe('CRITICAL')
    expect(defaultLevel(policy, 'BROKEN_LINK')).toBe('LOW')
    expect(defaultLevel(policy, 'UNKNOWN')).toBe('MEDIUM')
    expect(defaultLevel({ ...policy, levels: null }, 'MALWARE')).toBe('MEDIUM')
  })

  it('reads the penalty of a level', () => {
    expect(penaltyOf(policy, 'HIGH')).toEqual({ ban_days: 7, violation: true })
    expect(penaltyOf({ ...policy, levels: null }, 'HIGH')).toBeUndefined()
    expect(freezeDays(policy)).toBe(30)
  })

  it('tells what this and the next invalid reports cost the reporter', () => {
    expect(falseOutlook(policy, 4)).toEqual({
      count: 4,
      now: undefined,
      later: [
        { count: 5, ban_days: 3 },
        { count: 8, ban_days: 14 },
      ],
    })
    expect(falseOutlook(policy, 5)).toMatchObject({
      now: { count: 5, ban_days: 3 },
      later: [{ count: 8, ban_days: 14 }],
    })
    expect(falseOutlook(policy, 9)).toMatchObject({ now: undefined, later: [] })
  })
})

describe('checkNote', () => {
  it('names the state of the check of a file', () => {
    expect(checkNote({ file_check_status: 1 })).toBe('passed')
    expect(checkNote({ file_check_status: 6 })).toBe('held')
    expect(checkNote({ file_check_status: 0 })).toBe('pending')
    expect(checkNote({ file_check_status: 8 })).toBe('pending')
    expect(checkNote({ file_check_status: 5 })).toBe('failed')
  })
})
