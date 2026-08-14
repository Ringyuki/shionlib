import { Test } from '@nestjs/testing'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { HikarinagiBootstrapService } from './hikarinagi-bootstrap.service'
import { HikarinagiChangesService } from './hikarinagi-changes.service'
import { HikarinagiSyncService } from './hikarinagi-sync.service'

describe('HikarinagiBootstrapService', () => {
  const order: string[] = []

  const internal = {
    enabled: true,
    getMapping: jest.fn(),
  }
  const changes = {
    parkCursor: jest.fn(),
    latestEventId: jest.fn(),
  }
  const sync = {
    applyGalgame: jest.fn(),
  }

  let service: HikarinagiBootstrapService

  beforeEach(async () => {
    jest.clearAllMocks()
    order.length = 0

    changes.parkCursor.mockImplementation(() => {
      order.push('park')
      return Promise.resolve(9000)
    })
    changes.latestEventId.mockResolvedValue(9000)
    sync.applyGalgame.mockImplementation((hId: number) => {
      order.push(`apply:${hId}`)
      return Promise.resolve({ resolution: 'claimed' })
    })
    internal.getMapping.mockResolvedValue({
      items: [{ id: 10 }, { id: 20 }, { id: 30 }],
      meta: { total_pages: 1 },
    })

    const moduleRef = await Test.createTestingModule({
      providers: [
        HikarinagiBootstrapService,
        { provide: HikarinagiClient, useValue: internal },
        { provide: HikarinagiChangesService, useValue: changes },
        { provide: HikarinagiSyncService, useValue: sync },
      ],
    }).compile()
    service = moduleRef.get(HikarinagiBootstrapService)
  })

  it('parks the change cursor before mirroring anything so the backlog is not replayed', async () => {
    const result = await service.run({})

    expect(order[0]).toBe('park')
    expect(result.cursor).toBe(9000)
    expect(result.processed).toBe(3)
    expect(result.claimed).toBe(3)
  })

  it('reads the high-water mark without moving the cursor on a dry run', async () => {
    await service.run({ dryRun: true })

    expect(changes.parkCursor).not.toHaveBeenCalled()
    expect(changes.latestEventId).toHaveBeenCalled()
    expect(sync.applyGalgame).toHaveBeenCalledWith(10, true)
  })

  it('resumes after the given id so an interrupted run can continue', async () => {
    const result = await service.run({ from: 20 })

    expect(sync.applyGalgame).toHaveBeenCalledTimes(1)
    expect(sync.applyGalgame).toHaveBeenCalledWith(30, false)
    expect(result.lastId).toBe(30)
  })

  it('stops at the requested limit', async () => {
    const result = await service.run({ limit: 2 })

    expect(sync.applyGalgame).toHaveBeenCalledTimes(2)
    expect(result.processed).toBe(2)
    expect(result.lastId).toBe(20)
  })

  it('keeps going when a single entry fails and reports it', async () => {
    sync.applyGalgame.mockImplementation((hId: number) => {
      if (hId === 20) return Promise.reject(new Error('boom'))
      return Promise.resolve({ resolution: 'created' })
    })

    const result = await service.run({})

    expect(result.processed).toBe(3)
    expect(result.failed).toBe(1)
    expect(result.created).toBe(2)
  })

  it('does nothing when the internal channel is unconfigured', async () => {
    internal.enabled = false
    const result = await service.run({})
    internal.enabled = true

    expect(result.processed).toBe(0)
    expect(changes.parkCursor).not.toHaveBeenCalled()
    expect(sync.applyGalgame).not.toHaveBeenCalled()
  })
})
