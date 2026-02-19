jest.mock('../../search/helpers/format-doc', () => ({
  rawDataQuery: { id: true },
  formatDoc: jest.fn((data: any) => ({ id: data.id, formatted: true })),
}))

import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { S3Service } from '../../s3/services/s3.service'
import { SearchEngine } from '../../search/interfaces/search.interface'
import { EditActionType } from '../enums/edit-action-type.enum'
import { EditRelationType } from '../enums/edit-relation-type.enum'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { UndoMode } from '../enums/undo.enum'
import { formatDoc } from '../../search/helpers/format-doc'
import { UndoService } from './undo.service'

describe('UndoService', () => {
  const formatDocMock = formatDoc as unknown as jest.Mock

  function createService() {
    const prisma = {
      editRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      game: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService

    const activityService = {
      create: jest.fn(),
    } as unknown as ActivityService

    const searchEngine = {
      upsertGame: jest.fn(),
    } as unknown as SearchEngine

    const imageStorage = {} as S3Service

    const service = new UndoService(prisma, activityService, searchEngine, imageStorage)

    return {
      service,
      prisma,
      activityService,
      searchEngine,
    }
  }

  const req = { user: { sub: 7, role: 2 } } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('undo throws EDIT_RECORD_NOT_FOUND when target record does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.undo(1, req, { mode: UndoMode.STRICT } as any)).rejects.toMatchObject({
      code: ShionBizCode.EDIT_RECORD_NOT_FOUND,
    })
  })

  it('undo throws EDIT_RECORD_ALREADY_UNDONE when undo record exists', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'a' }, after: { title_jp: 'b' } },
      created: new Date('2026-02-18T00:00:00Z'),
      updated: new Date('2026-02-18T00:00:00Z'),
    })
    ;(prisma.editRecord.findFirst as jest.Mock).mockResolvedValue({ id: 99 })

    await expect(service.undo(1, req, { mode: UndoMode.STRICT } as any)).rejects.toMatchObject({
      code: ShionBizCode.EDIT_RECORD_ALREADY_UNDONE,
    })
  })

  it('undo strict mode throws conflict when overlapping records exist and force=false', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'a' }, after: { title_jp: 'b' } },
      created: new Date('2026-02-18T00:00:00Z'),
      updated: new Date('2026-02-18T00:00:00Z'),
    })
    ;(prisma.editRecord.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 2,
        entity: PermissionEntity.GAME,
        target_id: 10,
        action: EditActionType.UPDATE_SCALAR,
        relation_type: null,
        field_changes: ['title_jp'],
        changes: { before: { title_jp: 'b' }, after: { title_jp: 'c' } },
        created: new Date('2026-02-18T00:10:00Z'),
      },
    ])

    await expect(
      service.undo(1, req, { mode: UndoMode.STRICT, force: false, dryRun: false } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.EDIT_RECORD_CONFLICT,
    })
  })

  it('undo dryRun returns cascade plan with reversed overlap ids', async () => {
    const { service, prisma } = createService()
    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'a' }, after: { title_jp: 'b' } },
      created: new Date('2026-02-18T00:00:00Z'),
      updated: new Date('2026-02-18T00:00:00Z'),
    })
    ;(prisma.editRecord.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 2,
        entity: PermissionEntity.GAME,
        target_id: 10,
        action: EditActionType.UPDATE_SCALAR,
        relation_type: null,
        field_changes: ['title_jp'],
        changes: { before: { title_jp: 'b' }, after: { title_jp: 'c' } },
        created: new Date('2026-02-18T00:10:00Z'),
      },
      {
        id: 3,
        entity: PermissionEntity.GAME,
        target_id: 10,
        action: EditActionType.UPDATE_SCALAR,
        relation_type: null,
        field_changes: ['title_jp'],
        changes: { before: { title_jp: 'c' }, after: { title_jp: 'd' } },
        created: new Date('2026-02-18T00:20:00Z'),
      },
    ])

    const result = await service.undo(1, req, {
      mode: UndoMode.CASCADE,
      force: false,
      dryRun: true,
    } as any)

    expect(result).toEqual({
      target: 1,
      mode: UndoMode.CASCADE,
      willUndo: [1, 3, 2],
      conflicts: [2, 3],
    })
  })

  it('undo strict mode applies inverse once and refreshes index', async () => {
    const { service, prisma } = createService()
    const target = {
      id: 1,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'a' }, after: { title_jp: 'b' } },
      created: new Date('2026-02-18T00:00:00Z'),
      updated: new Date('2026-02-18T00:00:00Z'),
    }

    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue(target)
    ;(prisma.editRecord.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb({ tx: true }))

    const applyInverseSpy = jest.spyOn(service as any, 'applyInverse').mockResolvedValue(undefined)
    const refreshSpy = jest.spyOn(service as any, 'refreshIndex').mockResolvedValue(undefined)

    await service.undo(1, req, { mode: UndoMode.STRICT, dryRun: false } as any)

    expect(applyInverseSpy).toHaveBeenCalledTimes(1)
    expect(applyInverseSpy).toHaveBeenCalledWith({ tx: true }, target, req)
    expect(refreshSpy).toHaveBeenCalledWith(PermissionEntity.GAME, 10)
  })

  it('undo cascade mode applies inverse in reverse overlap order then target', async () => {
    const { service, prisma } = createService()
    const target = {
      id: 1,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'a' }, after: { title_jp: 'b' } },
      created: new Date('2026-02-18T00:00:00Z'),
      updated: new Date('2026-02-18T00:00:00Z'),
    }
    const overlapA = {
      id: 2,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'b' }, after: { title_jp: 'c' } },
      created: new Date('2026-02-18T00:10:00Z'),
    }
    const overlapB = {
      id: 3,
      entity: PermissionEntity.GAME,
      target_id: 10,
      action: EditActionType.UPDATE_SCALAR,
      relation_type: null,
      field_changes: ['title_jp'],
      changes: { before: { title_jp: 'c' }, after: { title_jp: 'd' } },
      created: new Date('2026-02-18T00:20:00Z'),
    }

    ;(prisma.editRecord.findUnique as jest.Mock).mockResolvedValue(target)
    ;(prisma.editRecord.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([overlapA, overlapB])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb({ tx: true }))

    const applyInverseSpy = jest.spyOn(service as any, 'applyInverse').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'refreshIndex').mockResolvedValue(undefined)

    await service.undo(1, req, { mode: UndoMode.CASCADE, dryRun: false } as any)

    expect((applyInverseSpy.mock.calls as any[]).map(c => c[1].id)).toEqual([3, 2, 1])
  })

  it('isOverlap handles scalar/relation overlap cases', () => {
    const { service } = createService()
    const isOverlap = (service as any).isOverlap.bind(service)

    expect(
      isOverlap(
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_SCALAR,
          field_changes: ['a'],
        },
        {
          entity: 'developer',
          target_id: 1,
          action: EditActionType.UPDATE_SCALAR,
          field_changes: ['a'],
        },
      ),
    ).toBe(false)

    expect(
      isOverlap(
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_SCALAR,
          field_changes: ['title_jp'],
        },
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_SCALAR,
          field_changes: ['title_jp', 'intro_jp'],
        },
      ),
    ).toBe(true)

    expect(
      isOverlap(
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_SCALAR,
          field_changes: ['title_jp'],
        },
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.ADD_RELATION,
          relation_type: EditRelationType.LINK,
          field_changes: ['links'],
          changes: { relation: 'links', added: [{ id: 1 }] },
        },
      ),
    ).toBe(false)

    expect(
      isOverlap(
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_RELATION,
          relation_type: EditRelationType.LINK,
          changes: { relation: 'links', before: [{ id: 1 }] },
        },
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.UPDATE_RELATION,
          relation_type: EditRelationType.LINK,
          changes: { relation: 'links', after: [{ id: 1 }] },
        },
      ),
    ).toBe(true)

    expect(
      isOverlap(
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.ADD_RELATION,
          relation_type: EditRelationType.IMAGE,
          changes: { relation: 'images', added: [{ id: 1 }] },
        },
        {
          entity: 'game',
          target_id: 1,
          action: EditActionType.ADD_RELATION,
          relation_type: EditRelationType.LINK,
          changes: { relation: 'links', added: [{ id: 1 }] },
        },
      ),
    ).toBe(false)
  })

  it('applyInverse dispatches by entity and throws for unsupported entity', async () => {
    const { service } = createService()
    const tx = {} as any

    const gameSpy = jest.spyOn(service as any, 'inverseGame').mockResolvedValue(undefined)
    const devSpy = jest.spyOn(service as any, 'inverseDeveloper').mockResolvedValue(undefined)
    const charSpy = jest.spyOn(service as any, 'inverseCharacter').mockResolvedValue(undefined)

    await (service as any).applyInverse(tx, { entity: PermissionEntity.GAME }, req)
    await (service as any).applyInverse(tx, { entity: PermissionEntity.DEVELOPER }, req)
    await (service as any).applyInverse(tx, { entity: PermissionEntity.CHARACTER }, req)

    expect(gameSpy).toHaveBeenCalledTimes(1)
    expect(devSpy).toHaveBeenCalledTimes(1)
    expect(charSpy).toHaveBeenCalledTimes(1)

    await expect((service as any).applyInverse(tx, { entity: 'other' }, req)).rejects.toMatchObject(
      {
        code: ShionBizCode.COMMON_NOT_IMPLEMENTED,
      },
    )
  })

  it('inverseDeveloper handles UPDATE_SCALAR and writes undo activity', async () => {
    const { service, activityService } = createService()
    const tx = {
      gameDeveloper: { update: jest.fn().mockResolvedValue(undefined) },
      editRecord: { create: jest.fn().mockResolvedValue({ id: 200 }) },
    }

    await (service as any).inverseDeveloper(
      tx,
      {
        id: 10,
        target_id: 99,
        action: EditActionType.UPDATE_SCALAR,
        changes: { before: { name: 'old' }, after: { name: 'new' } },
      },
      req,
    )

    expect(tx.gameDeveloper.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { name: 'old' },
    })
    expect(tx.editRecord.create).toHaveBeenCalledTimes(1)
    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.DEVELOPER_EDIT,
        user_id: 7,
        developer_id: 99,
        edit_record_id: 200,
      },
      tx,
    )
  })

  it('inverseCharacter handles UPDATE_SCALAR and writes undo activity', async () => {
    const { service, activityService } = createService()
    const tx = {
      gameCharacter: { update: jest.fn().mockResolvedValue(undefined) },
      editRecord: { create: jest.fn().mockResolvedValue({ id: 300 }) },
    }

    await (service as any).inverseCharacter(
      tx,
      {
        id: 11,
        target_id: 77,
        action: EditActionType.UPDATE_SCALAR,
        changes: { before: { name_jp: 'old' }, after: { name_jp: 'new' } },
      },
      req,
    )

    expect(tx.gameCharacter.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { name_jp: 'old' },
    })
    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.CHARACTER_EDIT,
        user_id: 7,
        character_id: 77,
        edit_record_id: 300,
      },
      tx,
    )
  })

  it('inverseGame handles UPDATE_SCALAR and LINK ADD_RELATION branches', async () => {
    const { service, activityService } = createService()
    const tx = {
      game: { update: jest.fn().mockResolvedValue(undefined) },
      gameLink: { deleteMany: jest.fn().mockResolvedValue(undefined) },
      editRecord: {
        create: jest.fn().mockResolvedValueOnce({ id: 400 }).mockResolvedValueOnce({ id: 401 }),
      },
    }

    await (service as any).inverseGame(
      tx,
      {
        id: 20,
        target_id: 50,
        action: EditActionType.UPDATE_SCALAR,
        relation_type: null,
        changes: { before: { title_jp: 'old' }, after: { title_jp: 'new' } },
      },
      req,
    )

    await (service as any).inverseGame(
      tx,
      {
        id: 21,
        target_id: 50,
        action: EditActionType.ADD_RELATION,
        relation_type: EditRelationType.LINK,
        changes: {
          relation: 'links',
          added: [
            { id: 9, url: 'u1', label: 'l1', name: 'n1' },
            { url: 'u2', label: 'l2', name: 'n2' },
          ],
        },
      },
      req,
    )

    expect(tx.game.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { title_jp: 'old' },
    })
    expect(tx.gameLink.deleteMany).toHaveBeenCalledWith({
      where: { game_id: 50, id: { in: [9] } },
    })
    expect(tx.gameLink.deleteMany).toHaveBeenCalledWith({
      where: { game_id: 50, url: 'u2', label: 'l2', name: 'n2' },
    })
    expect(activityService.create).toHaveBeenNthCalledWith(
      1,
      {
        type: ActivityType.GAME_EDIT,
        user_id: 7,
        game_id: 50,
        edit_record_id: 400,
      },
      tx,
    )
    expect(activityService.create).toHaveBeenNthCalledWith(
      2,
      {
        type: ActivityType.GAME_EDIT,
        user_id: 7,
        game_id: 50,
        edit_record_id: 401,
      },
      tx,
    )
  })

  it('refreshIndex updates search index only for existing game entity', async () => {
    const { service, prisma, searchEngine } = createService()

    await (service as any).refreshIndex(PermissionEntity.DEVELOPER, 1)
    expect(prisma.game.findUnique).not.toHaveBeenCalled()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue(null)
    await (service as any).refreshIndex(PermissionEntity.GAME, 10)
    expect(searchEngine.upsertGame).not.toHaveBeenCalled()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue({ id: 10 })
    await (service as any).refreshIndex(PermissionEntity.GAME, 10)

    expect(prisma.game.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { id: true },
    })
    expect(formatDocMock).toHaveBeenCalledWith({ id: 10 })
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 10, formatted: true })
  })
})
