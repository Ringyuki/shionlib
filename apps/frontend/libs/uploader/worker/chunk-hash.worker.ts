/// <reference lib="webworker" />

import { createSHA256 } from 'hash-wasm'
import { ChunkHashWorkerRequest } from '../types/worker'

const ctx = self as DedicatedWorkerGlobalScope

ctx.onmessage = async event => {
  const data = event.data as ChunkHashWorkerRequest
  if (data.type !== 'chunk-hash') return

  try {
    const hasher = await createSHA256()
    hasher.init()
    hasher.update(new Uint8Array(data.buffer))
    const digest = hasher.digest('hex')

    ctx.postMessage({
      type: 'chunk-hash-complete',
      id: data.id,
      digest,
    })
  } catch (err: any) {
    const error = err as Error
    ctx.postMessage({
      type: 'chunk-hash-error',
      id: data.id,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? 'Unknown error',
      },
    })
  }
}
