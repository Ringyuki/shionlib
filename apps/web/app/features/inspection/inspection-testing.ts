import type { Entry, Inspection } from './inspection'

export function entry(id: number, changes: Partial<Entry> = {}): Entry {
  return {
    id,
    parent_id: null,
    name: `file-${id}.dat`,
    kind: 'file',
    size: 10,
    modified: null,
    items: 0,
    children: 0,
    encrypted: false,
    unreadable: false,
    preview: null,
    track: null,
    ...changes,
  }
}

export function folder(id: number, name: string, children: number, parent: number | null = null) {
  return entry(id, { name, kind: 'folder', children, items: children, parent_id: parent })
}

export function inspection(id: number, changes: Partial<Inspection> = {}): Inspection {
  return {
    id,
    status: 'ready',
    archive: {
      format: '7z',
      solid: false,
      volumes: 1,
      recovery: false,
      recovery_percent: 0,
      name_encoding: '',
      unsupported: false,
    },
    files: 2,
    folders: 1,
    size: 100,
    disc_files: 0,
    truncated: false,
    verified: true,
    scan: {
      engine: 'ClamAV 1.4.3',
      signatures_at: '2026-10-11T06:26:01.000Z',
      scanned: 1,
      skipped: null,
      limit: 4194304000,
      detections: null,
      at: '2026-10-11T16:07:30.000Z',
      cleared_at: null,
    },
    discs: null,
    created: '2026-10-11T16:07:30.000Z',
    ...changes,
  }
}
