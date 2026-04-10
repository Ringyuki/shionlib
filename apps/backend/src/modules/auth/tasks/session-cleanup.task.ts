import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma.service'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'

const RETENTION_DAYS = 7

@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

    try {
      const { count } = await this.prisma.userLoginSession.deleteMany({
        where: {
          expires_at: { lt: cutoff },
          status: {
            in: [
              UserLoginSessionStatus.ROTATED,
              UserLoginSessionStatus.REUSED,
              UserLoginSessionStatus.BLOCKED,
            ],
          },
        },
      })

      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired session(s)`)
      }
    } catch (err) {
      this.logger.error(`Session cleanup failed: ${err?.message}`)
    }
  }
}
