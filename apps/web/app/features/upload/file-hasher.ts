import { hashReportFrom, type HashReport } from './upload.schema'

export type HashWorker = {
  start: (file: Blob, chunkSize: number, receive: (report: HashReport) => void) => void
  terminate: () => void
}

type Waiter = { resolve: (digest: string) => void; reject: (error: Error) => void }

export class FileReadError extends Error {
  constructor(name: string, message: string) {
    super(message)
    this.name = name
  }
}

export class FileHasher {
  private readonly worker: HashWorker
  private readonly chunks = new Map<number, string>()
  private readonly waiting = new Map<number | 'file', Waiter[]>()
  private whole: string | undefined
  private failure: Error | undefined

  constructor(worker: HashWorker, file: Blob, chunkSize: number) {
    this.worker = worker
    worker.start(file, chunkSize, report => this.receive(report))
  }

  chunkDigest(index: number): Promise<string> {
    return this.wait(index, this.chunks.get(index))
  }

  fileDigest(): Promise<string> {
    return this.wait('file', this.whole)
  }

  dispose() {
    this.worker.terminate()
    this.fail(new Error('The hasher was disposed'))
  }

  private wait(key: number | 'file', known: string | undefined): Promise<string> {
    if (known !== undefined) {
      return Promise.resolve(known)
    }
    if (this.failure !== undefined) {
      return Promise.reject(this.failure)
    }
    return new Promise((resolve, reject) => {
      this.waiting.set(key, [...(this.waiting.get(key) ?? []), { resolve, reject }])
    })
  }

  private receive(report: HashReport) {
    if (report.kind === 'error') {
      this.fail(new FileReadError(report.name ?? 'Error', report.message))
      return
    }
    const key = report.kind === 'chunk' ? report.index : 'file'
    const digest = report.kind === 'chunk' ? report.sha256 : report.blake3
    if (report.kind === 'chunk') {
      this.chunks.set(report.index, digest)
    } else {
      this.whole = digest
    }
    this.waiting.get(key)?.forEach(waiter => waiter.resolve(digest))
    this.waiting.delete(key)
  }

  private fail(error: Error) {
    this.failure ??= error
    this.waiting.forEach(waiters => waiters.forEach(waiter => waiter.reject(this.failure ?? error)))
    this.waiting.clear()
  }
}

export function browserHashWorker(): HashWorker {
  const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
  return {
    start(file, chunkSize, receive) {
      worker.addEventListener('message', (event: MessageEvent<unknown>) =>
        receive(hashReportFrom(event.data)),
      )
      worker.addEventListener('error', event => receive({ kind: 'error', message: event.message }))
      worker.postMessage({ file, chunkSize })
    },
    terminate: () => worker.terminate(),
  }
}
