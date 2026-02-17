import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Worker, WorkerOptions } from 'node:worker_threads'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  HashWorkerRequest,
  HashWorkerResponse,
  HashWorkerErrorMessage,
} from '../workers/hash.worker'

type HashWorkerJob = {
  payload: HashWorkerRequest
  resolve: (digest: string) => void
  reject: (error: Error) => void
}

@Injectable()
export class HashWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(HashWorkerService.name)
  private readonly workerEntry = this.resolveWorkerEntry()
  private readonly workerOptions = this.resolveWorkerOptions(this.workerEntry)
  private worker: Worker | null = null
  private currentJob: HashWorkerJob | null = null
  private readonly queue: HashWorkerJob[] = []

  async calculateHash(payload: HashWorkerRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, resolve, reject })
      this.processQueue()
    })
  }

  async onModuleDestroy() {
    await this.terminateWorker()
  }

  private processQueue() {
    if (this.currentJob || this.queue.length === 0) return

    this.currentJob = this.queue.shift()!
    try {
      this.ensureWorker().postMessage(this.currentJob.payload)
    } catch (err) {
      this.rejectCurrentJob(err instanceof Error ? err : new Error('failed to post message'))
      void this.restartWorker().finally(() => this.processQueue())
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    this.worker = new Worker(this.workerEntry, this.workerOptions)
    this.worker.on('message', this.handleMessage)
    this.worker.on('error', this.handleError)
    this.worker.on('exit', this.handleExit)
    return this.worker
  }

  private handleMessage = (message: HashWorkerResponse | HashWorkerErrorMessage) => {
    if (!this.currentJob) return

    const job = this.currentJob
    this.currentJob = null

    if (this.isWorkerError(message)) {
      job.reject(new Error(message.error))
    } else {
      job.resolve(message.digest)
    }

    this.processQueue()
  }

  private handleError = (err: Error) => {
    this.logger.error(`hash worker error: ${err.message}`)
    this.rejectCurrentJob(err)
    void this.restartWorker().finally(() => this.processQueue())
  }

  private handleExit = (code: number) => {
    if (code !== 0) {
      const error = new Error(`hash worker exited with code ${code}`)
      this.logger.error(error.message)
      this.rejectCurrentJob(error)
    }
    this.worker = null
    this.processQueue()
  }

  private rejectCurrentJob(error: Error) {
    if (!this.currentJob) return

    this.currentJob.reject(error)
    this.currentJob = null
  }

  private async restartWorker() {
    const worker = this.worker
    if (!worker) return

    this.worker = null
    try {
      await worker.terminate()
    } catch (err) {
      this.logger.warn(`failed to terminate hash worker during restart: ${(err as Error).message}`)
    }
  }

  private async terminateWorker() {
    const worker = this.worker
    if (!worker) return

    this.worker = null
    try {
      await worker.terminate()
    } catch (err) {
      this.logger.warn(`failed to terminate hash worker: ${(err as Error).message}`)
    }

    if (this.currentJob) {
      this.currentJob.reject(new Error('hash worker terminated'))
      this.currentJob = null
    }

    while (this.queue.length > 0) {
      const job = this.queue.shift()
      job?.reject(new Error('hash worker terminated'))
    }
  }

  private isWorkerError(
    message: HashWorkerResponse | HashWorkerErrorMessage,
  ): message is HashWorkerErrorMessage {
    return (message as HashWorkerErrorMessage).type === 'error'
  }

  private resolveWorkerEntry(): string {
    const basePath = path.resolve(__dirname, '../workers/hash.worker')
    const jsPath = `${basePath}.js`
    const tsPath = `${basePath}.ts`

    if (fs.existsSync(jsPath)) return jsPath
    if (fs.existsSync(tsPath)) return tsPath

    this.logger.error('failed to locate hash.worker file, please confirm the build artifacts exist')
    throw new Error('failed to locate hash.worker file, please confirm the build artifacts exist')
  }

  private resolveWorkerOptions(entry: string): WorkerOptions | undefined {
    if (!entry.endsWith('.ts')) return undefined

    const execArgv = ['-r', 'ts-node/register']
    if (this.moduleExists('tsconfig-paths/register')) {
      execArgv.push('-r', 'tsconfig-paths/register')
    }
    return { execArgv }
  }

  private moduleExists(request: string) {
    try {
      require.resolve(request)
      return true
    } catch {
      return false
    }
  }
}
