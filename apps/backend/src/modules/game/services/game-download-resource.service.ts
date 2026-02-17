import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { Prisma } from '@prisma/client'
import {
  CreateGameDownloadSourceReqDto,
  MigrateCreateGameDownloadSourceReqDto,
} from '../dto/req/create-game-download-source.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { S3Service } from '../../s3/services/s3.service'
import { GAME_STORAGE } from '../../s3/constants/s3.constants'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { GetGameDownloadResourceResDto } from '../dto/res/get-game-download-resource.res.dto'
import { B2Service } from '../../b2/services/b2.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { GetDownloadResourcesListResDto } from '../dto/res/get-download-resources-list.res.dto'
import { ActivityService } from '../../activity/services/activity.service'
import {
  ActivityType,
  ActivityFileStatus,
  ActivityFileCheckStatus,
} from '../../activity/dto/create-activity.dto'
import { CreateGameDownloadSourceFileReqDto } from '../dto/req/create-game-download-source-file.req.dto'
import { EditGameDownloadSourceReqDto } from '../dto/req/edit-game-download-source.req.dto'
import { ReuploadFileReqDto } from '../dto/req/reupload-file.req.dto'
import { GetFileHistoryResDto } from '../dto/res/get-file-history.res.dto'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { TurnstileResInterface } from '../interfaces/turnstile/turnstile-res.interface'
import { UploadQuotaService } from '../../upload/services/upload-quota.service'
import { MessageService } from '../../message/services/message.service'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'

@Injectable()
export class GameDownloadSourceService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(GAME_STORAGE) private readonly s3Service: S3Service,
    private readonly b2Service: B2Service,
    private readonly configService: ShionConfigService,
    private readonly activityService: ActivityService,
    private readonly httpService: HttpService,
    private readonly uploadQuotaService: UploadQuotaService,
    private readonly messageService: MessageService,
  ) {}

  async getByGameId(id: number, req: RequestWithUser): Promise<GetGameDownloadResourceResDto[]> {
    const game = await this.prismaService.game.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        download_resources: {
          where: {
            status: 1,
          },
          select: {
            id: true,
            platform: true,
            language: true,
            note: true,
            downloads: true,
            creator: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            created: true,
            updated: true,
            files: {
              select: {
                id: true,
                type: true,
                file_name: true,
                file_size: true,
                file_url: true,
                s3_file_key: true,
                hash_algorithm: true,
                file_hash: true,
                file_status: true,
                is_virus_false_positive: true,
                malware_scan_cases: {
                  select: {
                    id: true,
                    detected_viruses: true,
                  },
                },
                creator: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND, 'shion-biz.GAME_NOT_FOUND')
    }

    game.download_resources.forEach(r => {
      r.files = r.files.map(f => {
        return {
          ...f,
          file_size: Number(f.file_size),
        } as any
      })
    })

    game.download_resources.forEach(r => {
      r.files = r.files.filter(f => f.file_status === 3 || f.creator.id === req.user?.sub)
    })
    game.download_resources = game.download_resources.filter(r => r.files.length > 0)

    return game.download_resources as unknown as GetGameDownloadResourceResDto[]
  }

  async create(dto: CreateGameDownloadSourceReqDto, game_id: number, creator_id: number) {
    if (isNaN(Number(game_id))) {
      throw new ShionBizException(
        ShionBizCode.COMMON_VALIDATION_FAILED,
        'shion-biz.COMMON_VALIDATION_FAILED',
      )
    }
    const game = await this.prismaService.game.findUnique({
      where: {
        id: game_id,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND, 'shion-biz.GAME_NOT_FOUND')
    }
    const session = await this.prismaService.gameUploadSession.findUnique({
      where: {
        id: dto.upload_session_id,
      },
    })
    if (!session) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
      )
    }
    if (session.status !== 'COMPLETED') {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
        'shion-biz.GAME_UPLOAD_INVALID_SESSION_STATUS',
      )
    }
    if (session.creator_id !== creator_id) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
      )
    }
    const existingDownloadResource = await this.prismaService.gameDownloadResource.findFirst({
      where: {
        game_id,
        upload_session_id: dto.upload_session_id,
      },
      select: {
        id: true,
      },
    })
    if (existingDownloadResource) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED',
      )
    }

    await this.prismaService.$transaction(async tx => {
      const gameDownloadResource = await tx.gameDownloadResource.create({
        data: {
          game_id,
          platform: dto.platform,
          language: dto.language,
          note: dto.note,
          creator_id,
          upload_session_id: dto.upload_session_id,
        },
      })

      const gameDownloadResourceFile = await tx.gameDownloadResourceFile.create({
        data: {
          game_download_resource_id: gameDownloadResource.id,
          file_name: dto.file_name || session.file_name,
          file_path: session.storage_path,
          file_size: session.total_size,
          hash_algorithm: session.hash_algorithm,
          file_hash: session.file_sha256,
          file_content_type: session.mime_type,
          upload_session_id: dto.upload_session_id,
          creator_id,
          file_status: 2,
          type: 1,
        },
        select: {
          id: true,
        },
      })

      await this.activityService.create(
        {
          type: ActivityType.FILE_UPLOAD_TO_SERVER,
          user_id: creator_id,
          game_id: game_id,
          file_id: gameDownloadResourceFile.id,
          file_status: ActivityFileStatus.UPLOADED_TO_SERVER,
          file_check_status: ActivityFileCheckStatus.PENDING,
          file_size: Number(session.total_size),
          file_name: dto.file_name || session.file_name,
        },
        tx,
      )
    })
  }

  async edit(id: number, dto: EditGameDownloadSourceReqDto, req: RequestWithUser) {
    const resource = await this.prismaService.gameDownloadResource.findUnique({
      where: {
        id,
        status: 1,
      },
    })
    if (!resource) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_FOUND',
      )
    }
    if (
      resource.creator_id !== req.user?.sub &&
      ![ShionlibUserRoles.ADMIN, ShionlibUserRoles.SUPER_ADMIN].includes(req.user?.role)
    ) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_OWNER,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_OWNER',
      )
    }

    await this.prismaService.$transaction(async tx => {
      const row = await tx.gameDownloadResource.findUnique({
        where: { id },
        select: {
          updated: true,
        },
      })
      await tx.gameDownloadResource.update({
        where: { id },
        data: {
          platform: dto.platform,
          language: dto.language,
          note: dto.note,
          // in most situations, if we use this endpoint to edit a download resource, there should be only one file in it
          // so we update the file name for all files in the download resource
          files: {
            updateMany: {
              where: {
                game_download_resource_id: id,
              },
              data: {
                file_name: dto.file_name,
              },
            },
          },
          updated: row?.updated,
        },
      })
    })
  }

  async delete(id: number, req: RequestWithUser, soft?: boolean) {
    const resource = await this.prismaService.gameDownloadResource.findUnique({
      where: {
        id,
      },
    })
    if (!resource) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_FOUND',
      )
    }
    if (
      resource.creator_id !== req.user?.sub &&
      ![ShionlibUserRoles.ADMIN, ShionlibUserRoles.SUPER_ADMIN].includes(req.user?.role)
    ) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_OWNER,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_OWNER',
      )
    }
    const files = await this.prismaService.gameDownloadResourceFile.findMany({
      where: {
        game_download_resource_id: resource.id,
      },
    })
    for (const file of files) {
      if (file.s3_file_key) {
        await this.s3Service.deleteFile(file.s3_file_key)
      }
    }
    if (soft) {
      await this.prismaService.gameDownloadResource.update({
        where: { id },
        data: {
          status: 2,
          updated: new Date(),
        },
      })
    } else {
      await this.prismaService.gameDownloadResource.delete({
        where: {
          id,
        },
      })
    }
  }

  private async validateToken(token: string) {
    const data = await firstValueFrom(
      this.httpService.post<TurnstileResInterface>(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          response: token,
          secret: this.configService.get('cloudflare.turnstile.secret'),
        },
      ),
    )

    return {
      success: data.data.success,
      error_codes: data.data['error-codes'] as string[],
    }
  }

  async getDownloadLink(id: number, token: string) {
    if (!token) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED',
      )
    }
    const { success, error_codes } = await this.validateToken(token)
    if (!success) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN',
        {
          errorCodes: error_codes,
        },
      )
    }

    const file = await this.prismaService.gameDownloadResourceFile.findUnique({
      where: {
        id,
        game_download_resource: {
          status: 1,
        },
      },
      select: {
        game_download_resource_id: true,
        s3_file_key: true,
        file_size: true,
      },
    })
    if (!file) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND',
      )
    }

    await this.prismaService.$transaction(async tx => {
      const row = await tx.gameDownloadResource.findUnique({
        where: { id: file.game_download_resource_id },
        select: {
          updated: true,
        },
      })
      const { game_id } = await tx.gameDownloadResource.update({
        where: { id: file.game_download_resource_id },
        data: {
          downloads: {
            increment: 1,
          },
          updated: row?.updated,
        },
        select: {
          game_id: true,
        },
      })
      await tx.game.update({
        where: { id: game_id },
        data: {
          downloads: {
            increment: 1,
          },
        },
      })
    })

    let expiresIn = this.configService.get('file_download.download_expires_in')
    if (file.file_size > 1024 * 1024 * 1024 * 10) expiresIn = 4 * 60 * 60 // 4 hours
    if (file.file_size > 1024 * 1024 * 1024 * 20) expiresIn = 6 * 60 * 60 // 6 hours

    return {
      file_url: await this.b2Service.getDownloadUrl(file.s3_file_key!, expiresIn),
      expires_in: expiresIn,
    }
  }

  async getList(dto: PaginationReqDto): Promise<PaginatedResult<GetDownloadResourcesListResDto>> {
    const { page, pageSize } = dto

    const where = { status: 1 }
    const total = await this.prismaService.gameDownloadResource.count({ where })
    const resources = await this.prismaService.gameDownloadResource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        platform: true,
        language: true,
        note: true,
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
        files: {
          select: {
            file_name: true,
          },
        },
        downloads: true,
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        created: true,
      },
    })

    return {
      items: resources.map(r => ({
        id: r.id,
        platform: r.platform,
        language: r.language,
        note: r.note,
        downloads: r.downloads,
        game: r.game,
        files: r.files.map(f => f.file_name),
        files_count: r._count.files,
        creator: r.creator,
        created: r.created,
      })) as unknown as GetDownloadResourcesListResDto[],
      meta: {
        totalItems: total,
        itemCount: resources.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async migrateCreate(dto: MigrateCreateGameDownloadSourceReqDto, game_id: number) {
    const gameDownloadResource = await this.prismaService.$transaction(async tx => {
      const game = await tx.game.findUnique({
        where: {
          id: game_id,
        },
      })
      if (!game) {
        throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND, 'shion-biz.GAME_NOT_FOUND')
      }
      return await tx.gameDownloadResource.create({
        data: {
          game_id,
          platform: dto.platform,
          language: dto.language,
          note: dto.note,
          creator_id: 1,
        },
        select: {
          id: true,
        },
      })
    })

    return gameDownloadResource.id
  }

  async migrateCreateFile(
    dto: CreateGameDownloadSourceFileReqDto,
    game_download_resource_id: number,
  ) {
    return await this.prismaService.$transaction(async tx => {
      await tx.gameDownloadResourceFile.create({
        data: {
          type: 1,
          creator_id: 1,
          file_status: 3,
          game_download_resource_id,
          file_name: dto.file_name,
          file_size: dto.file_size,
          hash_algorithm: 'blake3',
          file_hash: dto.file_hash,
          file_content_type: dto.file_content_type,
          s3_file_key: dto.s3_file_key,
        },
      })
    })
  }

  async reuploadFile(fileId: number, dto: ReuploadFileReqDto, req: RequestWithUser) {
    const file = await this.prismaService.gameDownloadResourceFile.findUnique({
      where: { id: fileId, game_download_resource: { status: 1 } },
      include: {
        game_download_resource: {
          select: {
            id: true,
            game_id: true,
            creator_id: true,
            status: true,
            game: {
              select: {
                id: true,
                title_jp: true,
                title_zh: true,
                title_en: true,
              },
            },
          },
        },
      },
    })

    if (!file) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND',
      )
    }
    const oldFileStatus = file.file_status
    if (oldFileStatus !== ActivityFileStatus.UPLOADED_TO_S3) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_FILE_STATUS,
        'shion-biz.GAME_UPLOAD_INVALID_FILE_STATUS',
      )
    }

    if (
      file.creator_id !== req.user.sub &&
      ![ShionlibUserRoles.ADMIN, ShionlibUserRoles.SUPER_ADMIN].includes(req.user.role)
    ) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER',
      )
    }

    const session = await this.prismaService.gameUploadSession.findUnique({
      where: { id: dto.upload_session_id },
    })

    if (!session) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
      )
    }
    if (session.status !== 'COMPLETED') {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
        'shion-biz.GAME_UPLOAD_INVALID_SESSION_STATUS',
      )
    }
    if (session.creator_id !== req.user.sub) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
      )
    }

    const existingFileWithSession = await this.prismaService.gameDownloadResourceFile.findUnique({
      where: { upload_session_id: dto.upload_session_id },
    })
    if (existingFileWithSession && existingFileWithSession.id !== fileId) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_ALREADY_USED,
        'shion-biz.GAME_UPLOAD_SESSION_ALREADY_USED',
      )
    }

    const gameId = file.game_download_resource.game_id
    const game = file.game_download_resource.game
    const oldUploadSessionId = file.upload_session_id

    await this.prismaService.$transaction(async tx => {
      await tx.gameDownloadResourceFileHistory.create({
        data: {
          file_id: fileId,
          file_size: session.total_size,
          hash_algorithm: session.hash_algorithm,
          file_hash: session.file_sha256,
          reason: dto.reason,
          upload_session_id: session.id,
          operator_id: req.user.sub,
        },
      })
      await tx.gameDownloadResource.update({
        where: { id: file.game_download_resource_id },
        data: {
          updated: new Date(),
        },
      })

      if (file.s3_file_key) {
        await this.s3Service.deleteFile(file.s3_file_key, true)
      }

      if (oldUploadSessionId) {
        await this.uploadQuotaService.withdrawUploadQuotaUseAdjustment(
          file.creator_id,
          oldUploadSessionId,
        )
      }

      await tx.gameDownloadResourceFile.update({
        where: { id: fileId },
        data: {
          file_path: session.storage_path,
          file_size: session.total_size,
          file_hash: session.file_sha256,
          hash_algorithm: session.hash_algorithm,
          file_content_type: session.mime_type,
          file_status: 2,
          file_check_status: 0,
          is_virus_false_positive: false,
          s3_file_key: null,
          upload_session_id: dto.upload_session_id,
        },
      })
      await this.activityService.create(
        {
          type: ActivityType.FILE_REUPLOAD,
          user_id: req.user.sub,
          game_id: gameId,
          file_id: fileId,
          file_status: ActivityFileStatus.UPLOADED_TO_SERVER,
          file_check_status: ActivityFileCheckStatus.PENDING,
          file_size: Number(session.total_size),
          file_name: file.file_name,
        },
        tx,
      )

      await this.notifyFavoriteUsers(gameId, game, file.file_name, dto.reason, req.user.sub, tx)
    })

    return { ok: true }
  }

  async getFileHistory(fileId: number): Promise<GetFileHistoryResDto[]> {
    const file = await this.prismaService.gameDownloadResourceFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        creator_id: true,
        game_download_resource: {
          select: {
            creator_id: true,
          },
        },
      },
    })

    if (!file) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND',
      )
    }

    const histories = await this.prismaService.gameDownloadResourceFileHistory.findMany({
      where: { file_id: fileId },
      orderBy: { created: 'desc' },
      select: {
        id: true,
        file_size: true,
        hash_algorithm: true,
        file_hash: true,
        s3_file_key: true,
        reason: true,
        operator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        created: true,
      },
    })

    return histories.map(h => ({
      ...h,
      file_size: Number(h.file_size),
    }))
  }

  private async notifyFavoriteUsers(
    gameId: number,
    game: { id: number; title_jp: string | null; title_zh: string | null; title_en: string | null },
    fileName: string,
    reason: string | undefined,
    operatorId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const favorites = await (tx || this.prismaService).favoriteItem.findMany({
      where: {
        game_id: gameId,
        favorite: {
          user_id: { not: operatorId },
        },
      },
      select: { favorite: { select: { user_id: true } } },
    })

    for (const fav of favorites) {
      await this.messageService.send(
        {
          type: MessageType.SYSTEM,
          tone: MessageTone.SUCCESS,
          title: 'Messages.System.File.Reupload.FileReuploadedTitle',
          content: 'Messages.System.File.Reupload.FileReuploadedContent',
          game_id: gameId,
          meta: {
            file_name: fileName,
            reason: reason || undefined,
            game_title_jp: game.title_jp,
            game_title_zh: game.title_zh,
            game_title_en: game.title_en,
          },
          receiver_id: fav.favorite.user_id,
        },
        tx,
      )
    }
  }
}
