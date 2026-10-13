import { createHash } from 'node:crypto'
import { blake3 } from 'hash-wasm'
import { describe, expect, it } from 'vitest'
import { hashFile } from './upload-hash'
import type { HashReport } from './upload.schema'

describe('hashFile', () => {
  it('reports every chunk digest in order, then the whole file', async () => {
    const bytes = new TextEncoder().encode('0123456789')
    const reports: HashReport[] = []
    await hashFile(new Blob([bytes]), 4, report => reports.push(report))
    const sha = (part: Uint8Array) => createHash('sha256').update(part).digest('hex')
    expect(reports).toEqual([
      { kind: 'chunk', index: 0, sha256: sha(bytes.slice(0, 4)) },
      { kind: 'chunk', index: 1, sha256: sha(bytes.slice(4, 8)) },
      { kind: 'chunk', index: 2, sha256: sha(bytes.slice(8)) },
      { kind: 'file', blake3: await blake3(bytes) },
    ])
  })
})
