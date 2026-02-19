jest.mock('../../game/helpers/pick-changes', () => ({
  pickChanges: jest.fn(),
}))

jest.mock('../../edit/resolvers/permisson-resolver', () => ({
  characterRequiredBits: jest.fn(),
}))

import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { pickChanges } from '../../game/helpers/pick-changes'
import { characterRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { CharacterEditService } from './character-edit.service'

describe('CharacterEditService', () => {
  const pickChangesMock = pickChanges as unknown as jest.Mock
  const characterRequiredBitsMock = characterRequiredBits as unknown as jest.Mock

  function createService() {
    const prisma = {
      gameCharacter: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService

    const activityService = {
      create: jest.fn(),
    } as unknown as ActivityService

    const service = new CharacterEditService(prisma, activityService)

    return {
      service,
      prisma,
      activityService,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when character does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      service.editCharacterScalar(1, { name_jp: 'x' } as any, { user: { sub: 9 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
    })
  })

  it('returns early when no field changes detected', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({ id: 1, name_jp: 'old' })
    pickChangesMock.mockReturnValue({ before: {}, after: {}, field_changes: [] })

    await service.editCharacterScalar(
      1,
      { name_jp: 'old', note: 'same' } as any,
      { user: { sub: 1, role: 'USER' } } as any,
    )

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates scalar fields, writes edit record and creates activity when changed', async () => {
    const { service, prisma, activityService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 2,
      name_jp: 'before',
      name_zh: 'old-zh',
    })

    pickChangesMock.mockReturnValue({
      before: { name_jp: 'before' },
      after: { name_jp: 'after', name_zh: 'new-zh' },
      field_changes: ['name_jp', 'name_zh'],
    })
    characterRequiredBitsMock.mockReturnValue([0, 2])

    const tx = {
      gameCharacter: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      editRecord: {
        create: jest.fn().mockResolvedValue({ id: 88 }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(tx))

    await service.editCharacterScalar(
      2,
      { name_jp: 'after', name_zh: 'new-zh', note: 'update note' } as any,
      { user: { sub: 7, role: 'ADMIN' } } as any,
    )

    expect(pickChangesMock).toHaveBeenCalledWith(
      { name_jp: 'after', name_zh: 'new-zh' },
      expect.objectContaining({ id: 2 }),
    )
    expect(characterRequiredBitsMock).toHaveBeenCalledWith({ name_jp: 'after', name_zh: 'new-zh' })

    expect(tx.gameCharacter.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        name_jp: 'after',
        name_zh: 'new-zh',
      },
    })

    expect(tx.editRecord.create).toHaveBeenCalledWith({
      data: {
        entity: PermissionEntity.CHARACTER,
        target_id: 2,
        action: EditActionType.UPDATE_SCALAR,
        actor_id: 7,
        actor_role: 'ADMIN',
        field_mask: 5n,
        changes: {
          before: { name_jp: 'before' },
          after: { name_jp: 'after', name_zh: 'new-zh' },
        },
        field_changes: ['name_jp', 'name_zh'],
        note: 'update note',
      },
      select: { id: true },
    })

    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.CHARACTER_EDIT,
        user_id: 7,
        character_id: 2,
        edit_record_id: 88,
      },
      tx,
    )
  })
})
