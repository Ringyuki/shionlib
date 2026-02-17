import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { EditCharacterReqDto } from '../dto/req/edit-character.req.dto'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { pickChanges } from '../../game/helpers/pick-changes'
import { characterRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'

@Injectable()
export class CharacterEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async editCharacterScalar(id: number, dto: EditCharacterReqDto, req: RequestWithUser) {
    const character = await this.prisma.gameCharacter.findUnique({
      where: { id },
    })
    if (!character) {
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_NOT_FOUND)
    }

    const { note, ...rest } = dto
    const { before, after, field_changes } = pickChanges(rest, character)
    if (field_changes.length === 0) return

    const bits = characterRequiredBits(after)
    const field_mask = bits.reduce((m, b) => m | (1n << BigInt(b)), 0n)

    await this.prisma.$transaction(async tx => {
      await tx.gameCharacter.update({
        where: { id },
        data: {
          ...rest,
        },
      })

      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.CHARACTER,
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
          type: ActivityType.CHARACTER_EDIT,
          user_id: req.user.sub,
          character_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }
}
