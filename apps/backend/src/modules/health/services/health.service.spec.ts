import { ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { HealthService } from './health.service'

describe('HealthService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns healthy payload when db query succeeds', async () => {
    ;(prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }])
    const service = new HealthService(prismaMock)

    const result = await service.getHealth()

    expect(result.status).toBe('ok')
    expect(result.checks.db).toBe('up')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.latencyMs).toBe('number')
  })

  it('throws ServiceUnavailableException when db query fails', async () => {
    ;(prismaMock.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('db down'))
    const service = new HealthService(prismaMock)

    await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
