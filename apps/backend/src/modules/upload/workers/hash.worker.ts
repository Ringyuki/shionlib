import { parentPort } from 'node:worker_threads'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createBLAKE3 } from 'hash-wasm'
import { createHash } from 'node:crypto'

if (!parentPort) {
  throw new Error('This file must be run in a worker')
}

export type HashWorkerRequest = {
  filePath?: string
  step?: number
  data?: Buffer
  algorithm: 'blake3' | 'sha256'
}
export type HashWorkerResponse = {
  digest: string
}
export type HashWorkerErrorMessage = {
  type: 'error'
  error: string
}

parentPort.on('message', async (data: HashWorkerRequest) => {
  try {
    const { filePath, step = 5 * 1024 * 1024, data: bufferData, algorithm } = data
    const hasher = algorithm === 'blake3' ? await createBLAKE3() : createHash('sha256')

    if (bufferData) {
      hasher.update(new Uint8Array(bufferData))
    } else if (filePath) {
      await stat(filePath)
      const stream = createReadStream(filePath, { highWaterMark: step })
      for await (const chunk of stream) {
        hasher.update(new Uint8Array(chunk as Buffer))
      }
    }
    const digest = hasher.digest('hex') as string

    const msg: HashWorkerResponse = { digest }
    if (parentPort) parentPort.postMessage(msg)
  } catch (err) {
    if (parentPort)
      parentPort.postMessage({ type: 'error', error: err.message } as HashWorkerErrorMessage)
  }
})
