jest.mock('../../game/helpers/pick-changes', () => ({
  pickChanges: jest.fn(),
}))

jest.mock('../../edit/resolvers/permisson-resolver', () => ({
  developerRequiredBits: jest.fn(),
}))

import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { pickChanges } from '../../game/helpers/pick-changes'
import { developerRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { DeveloperEditService } from './developer-edit.service'

describe('DeveloperEditService', () => {
  const pickChangesMock = pickChanges as unknown as jest.Mock
  const developerRequiredBitsMock = developerRequiredBits as unknown as jest.Mock

  function createService() {
    const prisma = {
      gameDeveloper: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService

    const activityService = {
      create: jest.fn(),
    } as unknown as ActivityService

    const service = new DeveloperEditService(prisma, activityService)

    return {
      service,
      prisma,
      activityService,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when developer does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      service.editDeveloperScalar(1, { name: 'x' } as any, { user: { sub: 9 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })
  })

  it('returns early when no field changes detected', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({ id: 1, name: 'old' })
    pickChangesMock.mockReturnValue({ before: {}, after: {}, field_changes: [] })

    await service.editDeveloperScalar(
      1,
      { name: 'old', note: 'same' } as any,
      { user: { sub: 1, role: 'USER' } } as any,
    )

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates scalar fields, writes edit record and creates activity when changed', async () => {
    const { service, prisma, activityService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 2,
      name: 'before',
      aliases: ['a'],
      extra_info: { old: 1 },
    })

    pickChangesMock.mockReturnValue({
      before: { name: 'before' },
      after: { name: 'after', extra_info: { next: 1 } },
      field_changes: ['name', 'extra_info'],
    })
    developerRequiredBitsMock.mockReturnValue([1, 3])

    const tx = {
      gameDeveloper: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      editRecord: {
        create: jest.fn().mockResolvedValue({ id: 88 }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(tx))

    await service.editDeveloperScalar(
      2,
      { name: 'after', extra_info: { next: 1 }, note: 'update note' } as any,
      { user: { sub: 7, role: 'ADMIN' } } as any,
    )

    expect(pickChangesMock).toHaveBeenCalledWith(
      { name: 'after', extra_info: { next: 1 } },
      expect.objectContaining({ id: 2 }),
    )
    expect(developerRequiredBitsMock).toHaveBeenCalledWith({
      name: 'after',
      extra_info: { next: 1 },
    })

    expect(tx.gameDeveloper.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        name: 'after',
        extra_info: { next: 1 },
      },
    })

    expect(tx.editRecord.create).toHaveBeenCalledWith({
      data: {
        entity: PermissionEntity.DEVELOPER,
        target_id: 2,
        action: EditActionType.UPDATE_SCALAR,
        actor_id: 7,
        actor_role: 'ADMIN',
        field_mask: 10n,
        changes: {
          before: { name: 'before' },
          after: { name: 'after', extra_info: { next: 1 } },
        },
        field_changes: ['name', 'extra_info'],
        note: 'update note',
      },
      select: { id: true },
    })

    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.DEVELOPER_EDIT,
        user_id: 7,
        developer_id: 2,
        edit_record_id: 88,
      },
      tx,
    )
  })

  it('stores extra_info as undefined when dto.extra_info is falsy', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({ id: 3, name: 'before' })
    pickChangesMock.mockReturnValue({
      before: { name: 'before' },
      after: { name: 'after' },
      field_changes: ['name'],
    })
    developerRequiredBitsMock.mockReturnValue([2])

    const tx = {
      gameDeveloper: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      editRecord: {
        create: jest.fn().mockResolvedValue({ id: 99 }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(tx))

    await service.editDeveloperScalar(
      3,
      { name: 'after', extra_info: null, note: '' } as any,
      { user: { sub: 7, role: 'ADMIN' } } as any,
    )

    expect(tx.gameDeveloper.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        name: 'after',
        extra_info: undefined,
      },
    })
  })
})
