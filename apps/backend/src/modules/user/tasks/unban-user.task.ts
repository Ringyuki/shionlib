import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UserService } from '../services/user.service'
import { PrismaService } from '../../../prisma.service'
import { UserStatus } from '../interfaces/user.interface'

@Injectable()
export class UnbanUserTask {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const now = new Date()
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.BANNED },
      select: { id: true },
    })

    for (const user of users) {
      const record = await this.prisma.userBannedRecord.findFirst({
        where: { user_id: user.id, unbanned_at: null },
        orderBy: { banned_at: 'desc' },
        select: { is_permanent: true, banned_at: true, banned_duration_days: true },
      })
      if (!record || record.is_permanent) continue
      const { banned_at, banned_duration_days } = record
      if (banned_duration_days == null || banned_duration_days <= 0) continue
      const bannedUntil = new Date(banned_at.getTime() + banned_duration_days * 24 * 60 * 60 * 1000)
      if (bannedUntil <= now) await this.userService.unban(user.id)
    }
  }
}
