import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { EditDeveloperReqDto } from '../dto/req/edit-developer.req.dto'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { pickChanges } from '../../game/helpers/pick-changes'
import { developerRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'

@Injectable()
export class DeveloperEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async editDeveloperScalar(id: number, dto: EditDeveloperReqDto, req: RequestWithUser) {
    const developer = await this.prisma.gameDeveloper.findUnique({
      where: { id },
    })
    if (!developer) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    }

    const { note, ...rest } = dto
    const { before, after, field_changes } = pickChanges(rest, developer)
    if (field_changes.length === 0) return

    const bits = developerRequiredBits(after)
    const field_mask = bits.reduce((m, b) => m | (1n << BigInt(b)), 0n)

    await this.prisma.$transaction(async tx => {
      await tx.gameDeveloper.update({
        where: { id },
        data: {
          ...rest,
          extra_info: dto.extra_info ? (dto.extra_info as any) : undefined,
        },
      })

      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.DEVELOPER,
          target_id: id,
          action: EditActionType.UPDATE_SCALAR,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          field_mask,
          changes: { before, after } as any,
          field_changes,
          note,
        },
        select: { id: true },
      })

      await this.activityService.create(
        {
          type: ActivityType.DEVELOPER_EDIT,
          user_id: req.user.sub,
          developer_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }
}
