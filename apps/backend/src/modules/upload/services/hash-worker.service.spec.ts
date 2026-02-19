const mockWorkerInstances: any[] = []
type WorkerEvent = 'message' | 'error' | 'exit'
type WorkerHandler = (payload: any) => void

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs')
  return {
    ...actual,
    existsSync: jest.fn((p: string) => String(p).endsWith('.ts')),
  }
})

jest.mock('node:worker_threads', () => {
  class MockWorker {
    public readonly entry: string
    public readonly options: any
    public readonly handlers: Partial<Record<WorkerEvent, WorkerHandler>>
    public terminate = jest.fn().mockResolvedValue(0)
    public throwOnPostMessage: Error | null = null

    constructor(entry: string, options: any) {
      this.entry = entry
      this.options = options
      this.handlers = {}
    }

    on = jest.fn((event: WorkerEvent, cb: WorkerHandler) => {
      this.handlers[event] = cb
      return this
    })

    postMessage = jest.fn((payload: any) => {
      if (this.throwOnPostMessage) {
        const err = this.throwOnPostMessage
        this.throwOnPostMessage = null
        throw err
      }
      return payload
    })

    emit(event: WorkerEvent, payload: any) {
      const handler = this.handlers[event]
      if (handler) handler(payload)
    }
  }

  const Worker = jest.fn().mockImplementation((entry: string, options: any) => {
    const instance = new MockWorker(entry, options)
    mockWorkerInstances.push(instance)
    return instance
  })

  return { Worker }
})

import * as fs from 'node:fs'
import { Worker } from 'node:worker_threads'
import { HashWorkerService } from './hash-worker.service'

describe('HashWorkerService', () => {
  const WorkerMock = Worker as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkerInstances.length = 0
    ;(fs.existsSync as unknown as jest.Mock).mockImplementation((p: string) =>
      String(p).endsWith('.ts'),
    )
  })

  it('calculateHash queues jobs and resolves them in order via worker messages', async () => {
    const service = new HashWorkerService()

    const p1 = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('a') })
    const p2 = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('b') })

    expect(WorkerMock).toHaveBeenCalledTimes(1)
    const worker = mockWorkerInstances[0]
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.emit('message', { digest: 'digest-a' })
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    worker.emit('message', { digest: 'digest-b' })

    await expect(p1).resolves.toBe('digest-a')
    await expect(p2).resolves.toBe('digest-b')
  })

  it('calculateHash rejects when worker sends error message', async () => {
    const service = new HashWorkerService()
    const p = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('x') })

    const worker = mockWorkerInstances[0]
    worker.emit('message', { type: 'error', error: 'bad digest' })

    await expect(p).rejects.toThrow('bad digest')
  })

  it('rejects current job and restarts worker when postMessage throws', async () => {
    const service = new HashWorkerService()
    const worker = (service as any).ensureWorker()
    worker.throwOnPostMessage = new Error('post failed')

    const p = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('x') })
    await expect(p).rejects.toThrow('post failed')
    await Promise.resolve()

    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('handles worker error event: logs, rejects current job and restarts worker', async () => {
    const service = new HashWorkerService()
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})
    const worker = (service as any).ensureWorker()

    const p = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('x') })
    worker.emit('error', new Error('worker exploded'))

    await expect(p).rejects.toThrow('worker exploded')
    await Promise.resolve()
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('worker exploded'))
    expect(worker.terminate).toHaveBeenCalledTimes(1)

    loggerErrorSpy.mockRestore()
  })

  it('handles worker exit event with non-zero code', async () => {
    const service = new HashWorkerService()
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})
    const worker = (service as any).ensureWorker()

    const p = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('x') })
    worker.emit('exit', 2)

    await expect(p).rejects.toThrow('hash worker exited with code 2')
    expect(loggerErrorSpy).toHaveBeenCalledWith('hash worker exited with code 2')
    expect((service as any).worker).toBeNull()

    loggerErrorSpy.mockRestore()
  })

  it('ignores stray message when there is no current job', () => {
    const service = new HashWorkerService()
    const worker = (service as any).ensureWorker()

    expect(() => worker.emit('message', { digest: 'noop' })).not.toThrow()
  })

  it('onModuleDestroy terminates worker and rejects current + queued jobs', async () => {
    const service = new HashWorkerService()
    const worker = (service as any).ensureWorker()

    const p1 = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('1') })
    const p2 = service.calculateHash({ algorithm: 'sha256', data: Buffer.from('2') })

    await service.onModuleDestroy()

    await expect(p1).rejects.toThrow('hash worker terminated')
    await expect(p2).rejects.toThrow('hash worker terminated')
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('onModuleDestroy logs warning when terminate throws', async () => {
    const service = new HashWorkerService()
    const worker = (service as any).ensureWorker()
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {})
    worker.terminate.mockRejectedValueOnce(new Error('cannot terminate'))

    await service.onModuleDestroy()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('failed to terminate hash worker'))
    warnSpy.mockRestore()
  })

  it('restartWorker logs warning when terminate fails', async () => {
    const service = new HashWorkerService()
    const worker = (service as any).ensureWorker()
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {})
    worker.terminate.mockRejectedValueOnce(new Error('restart fail'))

    await (service as any).restartWorker()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to terminate hash worker during restart'),
    )
    expect((service as any).worker).toBeNull()
    warnSpy.mockRestore()
  })

  it('resolveWorkerEntry prefers js, then ts, and throws when neither exists', () => {
    const service = new HashWorkerService()
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})

    ;(fs.existsSync as unknown as jest.Mock).mockImplementation((p: any) =>
      String(p).endsWith('.js'),
    )
    expect((service as any).resolveWorkerEntry()).toMatch(/\.js$/)
    ;(fs.existsSync as unknown as jest.Mock).mockImplementation((p: any) =>
      String(p).endsWith('.ts'),
    )
    expect((service as any).resolveWorkerEntry()).toMatch(/\.ts$/)
    ;(fs.existsSync as unknown as jest.Mock).mockReturnValue(false)
    expect(() => (service as any).resolveWorkerEntry()).toThrow(
      'failed to locate hash.worker file, please confirm the build artifacts exist',
    )
    expect(loggerErrorSpy).toHaveBeenCalled()

    loggerErrorSpy.mockRestore()
  })

  it('resolveWorkerOptions builds execArgv only for ts entry and optional tsconfig-paths', () => {
    const service = new HashWorkerService()
    const moduleExistsSpy = jest.spyOn(service as any, 'moduleExists')

    expect((service as any).resolveWorkerOptions('/a/b/hash.worker.js')).toBeUndefined()

    moduleExistsSpy.mockReturnValueOnce(true)
    expect((service as any).resolveWorkerOptions('/a/b/hash.worker.ts')).toEqual({
      execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
    })

    moduleExistsSpy.mockReturnValueOnce(false)
    expect((service as any).resolveWorkerOptions('/a/b/hash.worker.ts')).toEqual({
      execArgv: ['-r', 'ts-node/register'],
    })

    moduleExistsSpy.mockRestore()
  })

  it('moduleExists returns true/false based on require.resolve', () => {
    const service = new HashWorkerService()

    expect((service as any).moduleExists('node:path')).toBe(true)
    expect((service as any).moduleExists('__definitely_not_existing_module__')).toBe(false)
  })
})
