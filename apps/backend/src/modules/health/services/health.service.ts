import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const startedAt = Date.now()

    try {
      await this.prisma.$queryRaw`SELECT 1`

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
          db: 'up',
        },
        latencyMs: Date.now() - startedAt,
      }
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
          db: 'down',
        },
        latencyMs: Date.now() - startedAt,
      })
    }
  }
}
