import { createBLAKE3 } from 'hash-wasm'
import type { HashReport } from './upload.schema'

export async function hashFile(
  file: Blob,
  chunkSize: number,
  report: (report: HashReport) => void,
) {
  const whole = await createBLAKE3()
  whole.init()
  const chunks = Math.max(1, Math.ceil(file.size / chunkSize))
  for (let index = 0; index < chunks; index++) {
    const start = index * chunkSize
    const bytes = new Uint8Array(await file.slice(start, start + chunkSize).arrayBuffer())
    whole.update(bytes)
    report({ kind: 'chunk', index, sha256: hex(await crypto.subtle.digest('SHA-256', bytes)) })
  }
  report({ kind: 'file', blake3: whole.digest('hex') })
}

function hex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
