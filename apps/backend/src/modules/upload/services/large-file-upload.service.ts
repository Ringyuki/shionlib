import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import * as fs from 'fs'
import * as path from 'path'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { GameUploadReqDto } from '../dto/req/game-upload.req.dto'
import { GameUploadSessionResDto } from '../dto/res/game-upload-session.res.dto'
import { GameUploadSession } from '@prisma/client'
import mime from 'mime-types'
import { UploadQuotaService } from './upload-quota.service'
import { UserUploadQuotaUsedAmountRecordAction } from '../dto/req/adjust-quota.req.dto'
import { HashWorkerService } from './hash-worker.service'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

@Injectable()
export class LargeFileUploadService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ShionConfigService,
    private readonly uploadQuotaService: UploadQuotaService,
    private readonly hashWorkerService: HashWorkerService,
  ) {}

  private get rootDir() {
    return this.configService.get('file_upload.upload_root_dir')
  }

  private destPath(id: string) {
    return path.join(
      this.rootDir,
      `${id}${this.configService.get('file_upload.upload_temp_file_suffix')}`,
    )
  }

  async init(dto: GameUploadReqDto, req: RequestWithUser): Promise<GameUploadSessionResDto> {
    if (await this.uploadQuotaService.isExceeded(req.user.sub, dto.total_size)) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
        'shion-biz.USER_UPLOAD_QUOTA_EXCEEDED',
      )
    }

    try {
      const chunk_size = dto.chunk_size ?? this.configService.get('file_upload.chunk_size')
      const total_chunks = Math.ceil(dto.total_size / chunk_size)
      if (total_chunks <= 0) {
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_INVALID_TOTAL_SIZE,
          'shion-biz.GAME_UPLOAD_INVALID_TOTAL_SIZE',
        )
      }
      if (total_chunks > this.configService.get('file_upload.upload_large_file_max_chunks')) {
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_TOO_MANY_CHUNKS,
          'shion-biz.GAME_UPLOAD_TOO_MANY_CHUNKS',
        )
      }
      if (
        dto.total_size > this.configService.get('file_upload.upload_large_file_max_size') &&
        req.user.role < ShionlibUserRoles.ADMIN
      ) {
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_TOO_LARGE,
          'shion-biz.GAME_UPLOAD_TOO_LARGE',
        )
      }

      const session = await this.prismaService.gameUploadSession.create({
        data: {
          file_name: dto.file_name,
          total_size: dto.total_size,
          chunk_size,
          total_chunks,
          uploaded_chunks: [],
          hash_algorithm: 'blake3',
          file_sha256: dto.file_sha256,
          status: 'UPLOADING',
          storage_path: this.destPath('PENDING'),
          expires_at: new Date(
            Date.now() + this.configService.get('file_upload.upload_session_expires_in'),
          ),
          creator_id: req.user.sub,
        },
      })

      const storage_path = this.destPath(session.id.toString())
      await this.prismaService.gameUploadSession.update({
        where: {
          id: session.id,
        },
        data: {
          storage_path,
        },
      })

      await fs.promises.mkdir(this.rootDir, { recursive: true })
      const fd = await fs.promises.open(storage_path, 'w')
      try {
        await fd.truncate(Number(dto.total_size))
      } finally {
        await fd.close()
      }

      await this.uploadQuotaService.adjustUploadQuotaUsedAmount(req.user.sub, {
        amount: dto.total_size,
        action: UserUploadQuotaUsedAmountRecordAction.USE,
        action_reason: 'GAME_UPLOAD',
        upload_session_id: session.id,
      })

      return {
        upload_session_id: session.id,
        chunk_size,
        total_chunks,
        expires_at: session.expires_at,
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async writeChunk(
    id: number,
    index: number,
    chunk_sha256: string,
    req: RequestWithUser,
    content_length: number,
  ) {
    const session = await this.prismaService.gameUploadSession.findUnique({
      where: {
        id,
      },
    })
    if (!session)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
      )

    if (session.status !== 'UPLOADING')
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
        'shion-biz.GAME_UPLOAD_INVALID_SESSION_STATUS',
      )
    if (index < 0 || index >= session.total_chunks)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_CHUNK_INDEX,
        'shion-biz.GAME_UPLOAD_INVALID_CHUNK_INDEX',
      )
    if (this.isSessionExpired(session))
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
        'shion-biz.GAME_UPLOAD_SESSION_EXPIRED',
      )

    if (session.creator_id !== req.user.sub)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
      )

    const chunk_size = session.chunk_size
    const isLast = index === session.total_chunks - 1
    const expected = isLast
      ? session.total_size - BigInt(session.total_chunks - 1) * BigInt(chunk_size)
      : BigInt(chunk_size)
    if (expected !== BigInt(content_length))
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_UNEXPECTED_CONTENT_LENGTH,
        'shion-biz.GAME_UPLOAD_UNEXPECTED_CONTENT_LENGTH',
        { expected: String(expected), actual: String(content_length) },
      )

    const storage_path = session.storage_path
    const offset = index * chunk_size
    let actualSha: string
    if (session.uploaded_chunks.includes(index)) {
      const lastChunkSize = Number(session.total_size) - (session.total_chunks - 1) * chunk_size
      const lengthToRead = isLast ? lastChunkSize : chunk_size
      const fd = await fs.promises.open(storage_path, 'r')
      try {
        const buffer = Buffer.alloc(Number(lengthToRead))
        const { bytesRead } = await fd.read(buffer, 0, Number(lengthToRead), Number(offset))
        actualSha = await this.hashWorkerService.calculateHash({
          algorithm: 'sha256',
          data: buffer.subarray(0, Number(bytesRead)),
        })
      } finally {
        await fd.close()
      }
      if (actualSha !== chunk_sha256)
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_INVALID_CHUNK_SHA256,
          'shion-biz.GAME_UPLOAD_INVALID_CHUNK_SHA256',
        )
    } else {
      const ws = fs.createWriteStream(storage_path, { flags: 'r+', start: offset })
      const rawBody = (req as any).body as Buffer | undefined
      // for express.raw has already parsed the body, hash and write from the buffer
      // ref: https://expressjs.com/en/resources/middleware/body-parser.html#bodyparserrawoptions
      // ref: @/main.ts
      // hash.update(rawBody as Buffer)
      await new Promise<void>((resolve, reject) => {
        ws.write(rawBody, err => {
          if (err) reject(err)
          else {
            ws.end(() => resolve())
          }
        })
      })

      const actualSha = await this.hashWorkerService.calculateHash({
        algorithm: 'sha256',
        data: rawBody,
      })
      if (actualSha !== chunk_sha256)
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_CHUNK_SHA256_MISMATCH,
          'shion-biz.GAME_UPLOAD_CHUNK_SHA256_MISMATCH',
        )

      await this.prismaService.gameUploadSession.update({
        where: {
          id: session.id,
        },
        data: {
          uploaded_chunks: {
            push: index,
          },
        },
      })
    }

    return {
      ok: true,
      chunk_index: index,
    }
  }

  async status(id: number, req: RequestWithUser) {
    const session = await this.prismaService.gameUploadSession.findUnique({
      where: {
        id,
      },
    })
    if (!session)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
      )
    if (this.isSessionExpired(session))
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
        'shion-biz.GAME_UPLOAD_SESSION_EXPIRED',
      )

    if (session.creator_id !== req.user.sub)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
      )

    return {
      status: session.status,
      uploaded_chunks: session.uploaded_chunks.sort((a, b) => a - b),
      file_sha256: session.file_sha256,
      total_size: Number(session.total_size),
      chunk_size: session.chunk_size,
      total_chunks: session.total_chunks,
      expires_at: session.expires_at,
    }
  }

  async complete(id: number, req: RequestWithUser) {
    const session = await this.prismaService.gameUploadSession.findUnique({
      where: {
        id,
      },
    })
    if (!session)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
      )

    if (session.status !== 'UPLOADING')
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
        'shion-biz.GAME_UPLOAD_INVALID_SESSION_STATUS',
      )

    if (session.uploaded_chunks.length !== session.total_chunks)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_INCOMPLETE,
        'shion-biz.GAME_UPLOAD_INCOMPLETE',
      )
    if (this.isSessionExpired(session))
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
        'shion-biz.GAME_UPLOAD_SESSION_EXPIRED',
      )

    if (session.creator_id !== req.user.sub)
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
        'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
      )

    const actualSha = await this.hashWorkerService.calculateHash({
      filePath: session.storage_path,
      algorithm: 'blake3',
    })
    if (actualSha !== session.file_sha256) {
      throw new ShionBizException(
        ShionBizCode.GAME_UPLOAD_FILE_BLAKE3_MISMATCH,
        'shion-biz.GAME_UPLOAD_FILE_BLAKE3_MISMATCH',
      )
    }

    const mime_type = mime.lookup(session.storage_path) || 'application/octet-stream'

    await this.prismaService.gameUploadSession.update({
      where: {
        id: session.id,
      },
      data: {
        status: 'COMPLETED',
        mime_type,
      },
    })

    return {
      ok: true,
      path: session.storage_path,
    }
  }

  async abort(id: number, req: RequestWithUser) {
    try {
      const session = await this.prismaService.gameUploadSession.findUnique({
        where: {
          id,
        },
      })
      if (!session)
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
          'shion-biz.GAME_UPLOAD_SESSION_NOT_FOUND',
        )

      if (session.status !== 'UPLOADING')
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
          'shion-biz.GAME_UPLOAD_INVALID_SESSION_STATUS',
        )
      if (this.isSessionExpired(session))
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
          'shion-biz.GAME_UPLOAD_SESSION_EXPIRED',
        )

      if (session.creator_id !== req.user.sub)
        throw new ShionBizException(
          ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
          'shion-biz.GAME_UPLOAD_SESSION_NOT_OWNER',
        )

      await this.prismaService.gameUploadSession.update({
        where: {
          id: session.id,
        },
        data: {
          status: 'ABORTED',
        },
      })
      await this.uploadQuotaService.withdrawUploadQuotaUseAdjustment(req.user.sub, session.id)

      await fs.promises.rm(session.storage_path, { force: true })
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  private isSessionExpired(session: GameUploadSession) {
    return session.expires_at < new Date()
  }

  async getOngoingSessions(req: RequestWithUser): Promise<GameUploadSessionResDto[]> {
    const sessions = await this.prismaService.gameUploadSession.findMany({
      where: { creator_id: req.user.sub, status: 'UPLOADING' },
      select: {
        id: true,
        file_name: true,
        file_sha256: true,
        total_size: true,
        uploaded_chunks: true,
        total_chunks: true,
        expires_at: true,
      },
    })
    return sessions.map(s => ({
      upload_session_id: s.id,
      file_name: s.file_name,
      file_sha256: s.file_sha256,
      total_size: Number(s.total_size),
      uploaded_chunks: s.uploaded_chunks,
      total_chunks: s.total_chunks,
      expires_at: s.expires_at,
    }))
  }
}
