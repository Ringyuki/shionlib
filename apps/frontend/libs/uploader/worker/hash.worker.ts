/// <reference lib="webworker" />

import { createBLAKE3 } from 'hash-wasm'
import { HashWorkerRequest } from '../types/worker'

const ctx = self as DedicatedWorkerGlobalScope

let aborted = false

ctx.onmessage = async event => {
  const data = event.data as HashWorkerRequest
  if (data.type === 'abort') {
    aborted = true
    return
  }
  if (data.type !== 'hash') return

  aborted = false

  try {
    const { file, step } = data
    const total = file.size
    const hasher = await createBLAKE3()
    hasher.init()

    let off = 0
    let nextPromise = file.slice(0, Math.min(step, total)).arrayBuffer()

    while (off < total) {
      if (aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const buffer = await nextPromise
      hasher.update(new Uint8Array(buffer))
      off = Math.min(off + step, total)
      ctx.postMessage({
        type: 'hash-progress',
        bytesHashed: off,
        totalBytes: total,
      })
      if (off < total) {
        const end = Math.min(off + step, total)
        nextPromise = file.slice(off, end).arrayBuffer()
      }
    }

    const digest = hasher.digest('hex')
    ctx.postMessage({
      type: 'hash-complete',
      digest,
    })
  } catch (error: any) {
    const err = error as Error
    ctx.postMessage({
      type: 'hash-error',
      error: {
        name: err?.name ?? 'Error',
        message: err?.message ?? 'Unknown error',
      },
    })
  }
}
