import { blake3 } from '@noble/hashes/blake3.js'
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js'
import {
  Phase,
  UploaderEvents,
  UploaderOptions,
  HashWorkerResponse,
  ChunkHashWorkerResponse,
  LargeFileUploadApi,
} from './types'
import { HASH_STEP_BYTES } from './constants/constant'
import { createShionlibLargeFileUploadApi } from './large-file-upload.api'

export class ShionlibLargeFileUploader {
  private file: File
  private api: LargeFileUploadApi
  private phase: Phase = 'idle'
  private startedAt = 0
  private bytesUploaded = 0
  private uploaded = new Set<number>()
  private sessionId?: number
  private chunkSize?: number
  private totalChunks?: number
  private fileSha256?: string
  private hashWorker?: Worker
  private chunkHashWorker?: Worker
  private chunkHashRequestId = 0
  private chunkHashPending = new Map<
    number,
    { resolve: (digest: string) => void; reject: (error: any) => void }
  >()
  private listeners = new Set<(e: UploaderEvents) => void>()
  private opts: Required<
    Omit<UploaderOptions, 'api' | 'desiredChunkSize' | 'smallFileThreshold'>
  > & {
    desiredChunkSize?: number
    smallFileThreshold: number
  }
  private abortController?: AbortController

  constructor(file: File, options: UploaderOptions = {}) {
    this.file = file
    this.api = options.api ?? createShionlibLargeFileUploadApi()
    this.opts = {
      concurrency: options.concurrency ?? 4,
      retry: options.retry ?? {
        retries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      },
      desiredChunkSize: options.desiredChunkSize,
      smallFileThreshold: options.smallFileThreshold ?? 1024 * 1024 * 100,
    }
  }

  on(fn: (e: UploaderEvents) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit(e: UploaderEvents) {
    this.listeners.forEach(f => f(e))
  }
  private setPhase(p: Phase) {
    this.phase = p
    this.emit({ type: 'status', phase: p })
  }

  private resetState() {
    this.disposeHashWorker()
    this.disposeChunkHashWorker()
    this.startedAt = 0
    this.bytesUploaded = 0
    this.uploaded.clear()
    this.sessionId = undefined
    this.chunkSize = undefined
    this.totalChunks = undefined
    this.fileSha256 = undefined
  }

  private disposeHashWorker() {
    if (this.hashWorker) {
      this.hashWorker.terminate()
      this.hashWorker = undefined
    }
  }

  async start() {
    if (this.phase === 'idle' || this.phase === 'error' || this.phase === 'aborted') {
      if (this.phase === 'aborted') {
        this.resetState()
      }
      this.abortController = new AbortController()
      try {
        this.setPhase('hashing')
        this.fileSha256 = await this.hashFile(this.file)

        this.setPhase('initializing')
        const init = await this.api.init(
          {
            file_name: this.file.name,
            total_size: this.file.size,
            file_sha256: this.fileSha256,
            chunk_size: this.opts.desiredChunkSize,
          },
          { signal: this.abortController?.signal },
        )
        this.sessionId = init.upload_session_id
        this.chunkSize = init.chunk_size
        this.totalChunks = init.total_chunks

        const st = await this.api.status(this.sessionId, { signal: this.abortController?.signal })
        st.uploaded_chunks.forEach(i => this.uploaded.add(i))
        this.bytesUploaded = this.uploadedSize()
      } catch (e: any) {
        if (e.name === 'AbortError') return
        this.setPhase('error')
        this.emit({ type: 'error', error: e })
      }
    }

    const canUpload =
      this.phase === 'idle' || this.phase === 'paused' || this.phase === 'initializing'
    if (canUpload) {
      try {
        this.setPhase('uploading')
        this.startedAt = performance.now()
        await this.uploadAll()

        this.setPhase('completing')
        await this.api.complete(this.sessionId!, { signal: this.abortController?.signal })
        this.setPhase('completed')
        this.emit({ type: 'done', sessionId: this.sessionId! })
      } catch (e) {
        if (this.phase === 'paused') return
        if (this.phase !== 'aborted') {
          this.setPhase('error')
          this.emit({ type: 'error', error: e })
        }
      }
    }
  }

  pause() {
    if (this.phase === 'uploading') this.setPhase('paused')
  }
  resume() {
    if (this.phase === 'paused') this.start()
  }
  async cancel() {
    if (this.phase === 'aborted') return
    this.setPhase('aborted')
    this.abortController?.abort()
    const sid = this.sessionId
    if (sid) {
      try {
        const cleanup = new AbortController()
        await this.api.abort(sid, { signal: cleanup.signal })
      } catch {}
    }
    this.resetState()
  }

  async resumeFromSession(sessionId: number) {
    if (this.phase === 'uploading') throw new Error('Already uploading')
    this.resetState()
    this.sessionId = sessionId
    this.abortController = new AbortController()
    try {
      this.setPhase('initializing')
      const st = await this.api.status(sessionId, { signal: this.abortController.signal })

      this.chunkSize = st.chunk_size
      this.totalChunks = st.total_chunks

      if (this.file.size !== st.total_size) {
        throw new Error('FileMismatch')
      }

      this.setPhase('hashing')
      const localHash = await this.hashFile(this.file)
      if (localHash !== st.file_sha256) {
        throw new Error('FileMismatch')
      }
      this.fileSha256 = localHash

      this.uploaded.clear()
      st.uploaded_chunks.forEach(i => this.uploaded.add(i))
      this.bytesUploaded = this.uploadedSize()

      this.setPhase('uploading')
      this.startedAt = performance.now()
      await this.uploadAll()

      this.setPhase('completing')
      await this.api.complete(this.sessionId!, { signal: this.abortController.signal })
      this.setPhase('completed')
      this.emit({ type: 'done', sessionId: this.sessionId! })
    } catch (e: any) {
      if (e?.message === 'FileMismatch') {
        this.emit({ type: 'file-mismatch', sessionId: this.sessionId! })
        return
      }
      if (this.phase === 'aborted' || e?.name === 'AbortError') return
      this.setPhase('error')
      this.emit({ type: 'error', error: e })
    }
  }

  private async uploadAll() {
    const total = this.totalChunks!
    const chunkSize = this.chunkSize!
    const pending: number[] = []
    for (let i = 0; i < total; i++) if (!this.uploaded.has(i)) pending.push(i)

    let cursor = 0
    const worker = async () => {
      while (this.phase === 'uploading' && cursor < pending.length) {
        const idx = pending[cursor++]
        await this.uploadOne(idx, chunkSize)
      }
    }

    const n = Math.min(this.opts.concurrency, Math.max(1, pending.length))
    await Promise.all(Array.from({ length: n }, () => worker()))
    if (this.phase !== 'uploading') throw new Error(`Stopped: ${this.phase}`)
  }

  private async uploadOne(index: number, chunkSize: number) {
    const start = index * chunkSize
    const end = Math.min(start + chunkSize, this.file.size)
    const blob = this.file.slice(start, end)
    const chunkSha = await this.hashChunk(blob)

    await this.withRetry(index, () =>
      this.api.putChunk(this.sessionId!, index, blob, chunkSha, {
        signal: this.abortController?.signal,
      }),
    )

    this.uploaded.add(index)
    this.bytesUploaded += blob.size
    const elapsed = (performance.now() - this.startedAt) / 1000
    const speed = elapsed > 0 ? this.bytesUploaded / elapsed : 0
    const remain = this.file.size - this.bytesUploaded
    const eta = speed > 0 ? Math.round(remain / speed) : null
    this.emit({
      type: 'progress',
      bytesUploaded: this.bytesUploaded,
      totalBytes: this.file.size,
      speedBps: speed,
      etaSec: eta,
    })
    this.emit({ type: 'chunk', index })
  }

  private async withRetry(index: number, fn: () => Promise<any>) {
    const { retries, baseDelayMs, maxDelayMs } = this.opts.retry
    for (let attempt = 1; ; attempt++) {
      if (this.abortController?.signal.aborted) throw new Error('Aborted')
      try {
        return await fn()
      } catch (e: any) {
        if (e.name === 'AbortError' || attempt > retries || this.phase !== 'uploading') throw e
        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
        this.emit({ type: 'retry', index, attempt, delayMs: delay })
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  private uploadedSize() {
    if (!this.chunkSize || !this.totalChunks) return 0
    const last = this.totalChunks - 1
    let bytes = 0
    for (const i of this.uploaded) {
      bytes +=
        i === last ? this.file.size - (this.totalChunks - 1) * this.chunkSize : this.chunkSize
    }

    return bytes
  }

  private async hashFile(file: File) {
    if (this.canUseHashWorker()) {
      try {
        return await this.hashFileWithWorker(file)
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          throw e
        }
        console.warn(
          '[ShionlibLargeFileUploader] hash worker failed, falling back to main thread',
          e,
        )
      }
    }

    return this.hashFileWithMainThread(file)
  }

  private canUseHashWorker() {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined'
  }

  private async hashFileWithMainThread(file: File) {
    const total = file.size
    const step = HASH_STEP_BYTES
    const hasher = blake3.create()
    let off = 0
    let nextPromise = file.slice(0, Math.min(step, total)).arrayBuffer()
    while (off < total) {
      if (this.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const ab = await nextPromise
      hasher.update(new Uint8Array(ab))
      off = Math.min(off + step, total)
      this.emit({ type: 'hash-progress', bytesHashed: off, totalBytes: total })
      if (off < total) {
        const end = Math.min(off + step, total)
        nextPromise = file.slice(off, end).arrayBuffer()
      }
      if (off % (1024 * 1024 * 256) === 0) {
        await new Promise(r => setTimeout(r))
      }
    }
    return this.toHex(hasher.digest())
  }

  private async hashFileWithWorker(file: File) {
    const worker = new Worker(new URL('./worker/hash.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.hashWorker = worker
    const signal = this.abortController?.signal
    const step = HASH_STEP_BYTES

    return await new Promise<string>((resolve, reject) => {
      let cleanedUp = false
      let abortHandler: (() => void) | undefined

      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler)
        }
        worker.terminate()
        if (this.hashWorker === worker) {
          this.hashWorker = undefined
        }
      }

      const rejectWithAbort = () => {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
      }

      abortHandler = () => {
        try {
          worker.postMessage({ type: 'abort' })
        } catch {}
        rejectWithAbort()
      }

      if (signal) {
        if (signal.aborted) {
          abortHandler()
          return
        }
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      worker.onmessage = event => {
        const data = event.data as HashWorkerResponse
        if (data.type === 'hash-progress') {
          this.emit({
            type: 'hash-progress',
            bytesHashed: data.bytesHashed,
            totalBytes: data.totalBytes,
          })
          return
        }

        if (data.type === 'hash-complete') {
          cleanup()
          resolve(data.digest)
          return
        }

        if (data.type === 'hash-error') {
          cleanup()
          if (data.error?.name === 'AbortError') {
            reject(new DOMException(data.error.message, 'AbortError'))
            return
          }
          const err = new Error(data.error?.message ?? 'Hash worker error')
          err.name = data.error?.name ?? 'Error'
          reject(err)
        }
      }

      worker.onerror = event => {
        cleanup()
        reject(event.error ?? new Error(event.message))
      }

      worker.postMessage({ type: 'hash', step, file })
    })
  }

  private getChunkHashWorker() {
    if (this.chunkHashWorker) return this.chunkHashWorker

    const worker = new Worker(new URL('./worker/chunk-hash.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = event => {
      const data = event.data as ChunkHashWorkerResponse
      if (data.type === 'chunk-hash-complete') {
        const pending = this.chunkHashPending.get(data.id)
        if (pending) {
          pending.resolve(data.digest)
          this.chunkHashPending.delete(data.id)
        }
        return
      }
      if (data.type === 'chunk-hash-error') {
        const pending = this.chunkHashPending.get(data.id)
        if (pending) {
          const err = new Error(data.error.message)
          err.name = data.error.name
          pending.reject(err)
          this.chunkHashPending.delete(data.id)
        }
      }
    }
    worker.onerror = event => {
      const err = event.error ?? new Error(event.message)
      this.disposeChunkHashWorker(err)
    }
    worker.onmessageerror = () => {
      this.disposeChunkHashWorker(new Error('Chunk hash worker message error'))
    }

    this.chunkHashWorker = worker
    return worker
  }

  private async hashChunkWithWorker(bytes: Uint8Array) {
    const signal = this.abortController?.signal
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const buffer =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

    const worker = this.getChunkHashWorker()
    const id = ++this.chunkHashRequestId

    return await new Promise<string>((resolve, reject) => {
      let abortHandler: (() => void) | undefined
      const cleanup = () => {
        if (abortHandler && signal) {
          signal.removeEventListener('abort', abortHandler)
        }
        this.chunkHashPending.delete(id)
      }

      const rejectWithAbort = () => {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      abortHandler = rejectWithAbort

      if (signal) {
        if (signal.aborted) {
          rejectWithAbort()
          return
        }
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      this.chunkHashPending.set(id, {
        resolve: digest => {
          cleanup()
          resolve(digest)
        },
        reject: err => {
          cleanup()
          reject(err)
        },
      })

      try {
        worker.postMessage({ type: 'chunk-hash', id, buffer }, [buffer])
      } catch (e) {
        cleanup()
        reject(e)
      }
    })
  }

  private async hashChunk(blob: Blob) {
    const signal = this.abortController?.signal
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    let bytes: Uint8Array | null = null
    const loadBytes = async () => {
      if (!bytes) {
        const ab = await blob.arrayBuffer()
        bytes = new Uint8Array(ab)
      }
      return bytes
    }

    try {
      if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
        const b = await loadBytes()
        const arrayBuffer = (
          b.byteOffset === 0 && b.byteLength === b.buffer.byteLength
            ? b.buffer
            : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
        ) as ArrayBuffer

        const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
        return this.toHex(new Uint8Array(digest))
      }
    } catch (e) {
      // crypto.subtle is not available in non-secure contexts (e.g. local network http)
      console.warn('[ShionlibLargeFileUploader] crypto.subtle.digest failed, falling back', e)
    }

    if (this.canUseHashWorker()) {
      try {
        const b = await loadBytes()
        return await this.hashChunkWithWorker(b)
      } catch (e: any) {
        if (e?.name === 'AbortError') throw e
        console.warn('[ShionlibLargeFileUploader] chunk hash worker failed, falling back', e)
      }
    }

    const b = await loadBytes()
    const digest = nobleSha256(b)
    return this.toHex(digest)
  }

  private toHex(arr: Uint8Array) {
    let s = ''
    for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0')
    return s
  }

  async getSessionId() {
    return this.sessionId
  }

  private disposeChunkHashWorker(error?: Error) {
    this.failAllChunkHashRequests(
      error ?? new Error('Chunk hash worker disposed before completion'),
    )
    if (this.chunkHashWorker) {
      this.chunkHashWorker.terminate()
      this.chunkHashWorker = undefined
    }
  }

  private failAllChunkHashRequests(error: Error) {
    if (!this.chunkHashPending.size) return
    for (const [, { reject }] of this.chunkHashPending) {
      reject(error)
    }
    this.chunkHashPending.clear()
  }
}
