import type { Schema } from '~/shared/api/types'
import type { Disc, Inspection } from './inspection'

const formatNames: Record<string, string> = {
  '7z': '7z',
  zip: 'ZIP',
  rar: 'RAR',
  rar5: 'RAR 5',
  tar: 'TAR',
  gzip: 'GZIP',
  bzip2: 'BZIP2',
  xz: 'XZ',
  zstd: 'Zstandard',
  cab: 'CAB',
  lzh: 'LZH',
  iso: 'ISO',
  udf: 'UDF',
}

const megabyte = 1024 * 1024

const nameEncodings = ['shift_jis', 'euc-jp', 'gbk', 'big5'] as const

export type NameEncoding = (typeof nameEncodings)[number]

export type ScanVerdict = 'clean' | 'cleared' | 'held'

export type EarlierCheck = 'passed' | 'released' | 'pending'

export type DiscFormat = 'iso9660' | 'iso9660+joliet' | 'udf' | 'audio' | 'unknown'

export type Integrity = 'verified' | 'unsupported' | 'untested'

export function formatName(format: string): string {
  return formatNames[format] ?? format.toUpperCase()
}

export function nameEncoding(
  archive: Pick<Inspection['archive'], 'name_encoding'>,
): NameEncoding | undefined {
  return nameEncodings.find(known => known === archive.name_encoding)
}

export function volumesOf(archive: Pick<Inspection['archive'], 'volumes'>): number {
  return archive.volumes > 1 ? archive.volumes : 0
}

export function scanned(inspection: Pick<Inspection, 'scan'>): boolean {
  return inspection.scan.at !== null
}

export function scanVerdict(inspection: Pick<Inspection, 'scan'>): ScanVerdict {
  if ((inspection.scan.detections ?? []).length === 0) {
    return 'clean'
  }
  return inspection.scan.cleared_at === null ? 'held' : 'cleared'
}

export function integrityOf(inspection: Pick<Inspection, 'verified' | 'archive'>): Integrity {
  if (inspection.verified) {
    return 'verified'
  }
  return inspection.archive.unsupported ? 'unsupported' : 'untested'
}

export function scanLimitMegabytes(inspection: Pick<Inspection, 'scan'>): number {
  return Math.round(inspection.scan.limit / megabyte)
}

export function discFormat(disc: Pick<Disc, 'format'>): DiscFormat {
  return (
    (['iso9660', 'iso9660+joliet', 'udf', 'audio'] as const).find(known => known === disc.format) ??
    'unknown'
  )
}

export function earlierCheck(
  files: readonly Pick<Schema<'DownloadFileDTO'>, 'stage' | 'is_virus_false_positive'>[],
): EarlierCheck {
  if (files.some(file => file.stage !== 'stored')) {
    return 'pending'
  }
  return files.some(file => file.is_virus_false_positive) ? 'released' : 'passed'
}
