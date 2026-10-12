import { describe, expect, it } from 'vitest'
import {
  discFormat,
  earlierCheck,
  formatName,
  integrityOf,
  nameEncoding,
  scanLimitMegabytes,
  scanVerdict,
  scanned,
  volumesOf,
} from './inspection-facts'
import { inspection } from './inspection-testing'

const scanOf = (changes: Partial<ReturnType<typeof inspection>['scan']>) => ({
  scan: { ...inspection(1).scan, ...changes },
})

describe('archive facts', () => {
  it('writes a format the way people know it', () => {
    expect(formatName('rar5')).toBe('RAR 5')
    expect(formatName('zip')).toBe('ZIP')
    expect(formatName('7z')).toBe('7z')
    expect(formatName('wim')).toBe('WIM')
  })

  it('names a legacy encoding and nothing for Unicode names', () => {
    expect(nameEncoding({ name_encoding: 'shift_jis' })).toBe('shift_jis')
    expect(nameEncoding({ name_encoding: '' })).toBeUndefined()
    expect(nameEncoding({ name_encoding: 'koi8-r' })).toBeUndefined()
  })

  it('counts volumes only for an archive that is split', () => {
    expect(volumesOf({ volumes: 3 })).toBe(3)
    expect(volumesOf({ volumes: 1 })).toBe(0)
    expect(volumesOf({ volumes: 0 })).toBe(0)
  })
})

describe('scan facts', () => {
  it('knows whether a scan was recorded', () => {
    expect(scanned(inspection(1))).toBe(true)
    expect(scanned(scanOf({ at: null }))).toBe(false)
  })

  it('tells a clean scan from a detection that waits and one that was cleared', () => {
    const detections = [{ path: 'Game/patch.exe', signature: 'Eicar' }]
    expect(scanVerdict(inspection(1))).toBe('clean')
    expect(scanVerdict(scanOf({ detections: [] }))).toBe('clean')
    expect(scanVerdict(scanOf({ detections }))).toBe('held')
    expect(scanVerdict(scanOf({ detections, cleared_at: '2026-03-02T00:00:00.000Z' }))).toBe(
      'cleared',
    )
  })

  it('gives the scan limit in megabytes', () => {
    expect(scanLimitMegabytes(inspection(1))).toBe(4000)
  })

  it('tells an archive that was not tested from one 7-Zip cannot unpack', () => {
    const { archive } = inspection(1)
    expect(integrityOf(inspection(1))).toBe('verified')
    expect(integrityOf({ verified: false, archive })).toBe('untested')
    expect(integrityOf({ verified: false, archive: { ...archive, unsupported: true } })).toBe(
      'unsupported',
    )
  })
})

describe('a file without a recorded scan', () => {
  it('passed, was released, or is still being checked', () => {
    const file = { stage: 'stored' as const, is_virus_false_positive: false }
    expect(earlierCheck([file])).toBe('passed')
    expect(earlierCheck([file, { ...file, is_virus_false_positive: true }])).toBe('released')
    expect(earlierCheck([file, { ...file, stage: 'checking' }])).toBe('pending')
    expect(earlierCheck([{ ...file, stage: 'under_review' }])).toBe('pending')
  })
})

describe('disc facts', () => {
  it('knows the file systems that are read', () => {
    expect(discFormat({ format: 'iso9660+joliet' })).toBe('iso9660+joliet')
    expect(discFormat({ format: 'udf' })).toBe('udf')
    expect(discFormat({ format: 'audio' })).toBe('audio')
    expect(discFormat({ format: '' })).toBe('unknown')
  })
})
