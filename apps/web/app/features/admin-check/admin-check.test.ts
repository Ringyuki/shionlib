import { describe, expect, it } from 'vitest'
import type { Inspection } from '~/features/inspection'
import { flagged, searchOf, searchWith, shortHash, waiting } from './admin-check'
import { filterFrom, outcomeFrom } from './admin-check.schema'

const inspection = (id: number, signatures: string[]): Inspection => ({
  id,
  status: 'ready',
  created: '2026-10-01T00:00:00.000Z',
  files: 1,
  folders: 0,
  disc_files: 0,
  size: 1,
  truncated: false,
  verified: true,
  discs: null,
  archive: {
    format: 'zip',
    name_encoding: '',
    recovery: false,
    recovery_percent: 0,
    solid: false,
    unsupported: false,
    volumes: 1,
  },
  scan: {
    at: '2026-10-01T00:00:00.000Z',
    cleared_at: null,
    detections: signatures.map(signature => ({ path: 'game/setup.exe', signature })),
    engine: 'ClamAV 1.4.3',
    limit: 1,
    scanned: 3,
    signatures_at: null,
    skipped: null,
  },
})

describe('the address of the page', () => {
  it('opens and closes a case and keeps the filter', () => {
    expect(searchWith('?result=ADMIN_ALLOW', 3)).toBe('?result=ADMIN_ALLOW&case=3')
    expect(searchWith('?result=ADMIN_ALLOW&case=3', undefined)).toBe('?result=ADMIN_ALLOW')
    expect(searchOf('TIMEOUT_AUTO_DELETE')).toBe('?result=TIMEOUT_AUTO_DELETE')
    expect(searchOf(undefined)).toBe('')
  })

  it('reads the filter and the opened case, also from the address in older notices', () => {
    expect(filterFrom(new URLSearchParams('result=ADMIN_DELETE&case=4'), 2)).toEqual({
      outcome: 'ADMIN_DELETE',
      opened: 4,
      page: 2,
    })
    expect(filterFrom(new URLSearchParams('id=6'), 1).opened).toBe(6)
    expect(filterFrom(new URLSearchParams('result=KEPT&case=x'), 1)).toEqual({
      outcome: undefined,
      opened: undefined,
      page: 1,
    })
  })

  it('accepts only known outcomes', () => {
    expect(outcomeFrom('ADMIN_ALLOW')).toBe('ADMIN_ALLOW')
    expect(outcomeFrom(null)).toBeUndefined()
    expect(outcomeFrom('PENDING')).toBeUndefined()
  })
})

describe('flagged', () => {
  it('finds the inspection that carries one of the detected names', () => {
    const inspections = [inspection(1, []), inspection(2, ['Win.Trojan.Generic'])]
    expect(flagged(inspections, ['Win.Trojan.Generic'])?.id).toBe(2)
    expect(flagged(inspections, ['Eicar'])).toBeUndefined()
    expect(flagged([], ['Eicar'])).toBeUndefined()
  })
})

describe('shortHash', () => {
  it('keeps both ends of a long value', () => {
    expect(shortHash('9f3a1c0e11112222333344445555666677778888e02b8c41')).toBe('9f3a1c0e…e02b8c41')
    expect(shortHash('abc123')).toBe('abc123')
  })
})

describe('waiting', () => {
  it('is true until a case is decided', () => {
    expect(waiting({ status: 'PENDING' })).toBe(true)
    expect(waiting({ status: 'DELETED' })).toBe(false)
  })
})
