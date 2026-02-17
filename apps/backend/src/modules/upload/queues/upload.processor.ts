import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger, Inject } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { S3Service } from '../../s3/services/s3.service'
import { GAME_STORAGE } from '../../s3/constants/s3.constants'
import { LARGE_FILE_UPLOAD_QUEUE, S3_UPLOAD_JOB } from '../constants/upload.constants'
import * as fs from 'fs'
import * as path from 'path'
import { ActivityService } from '../../activity/services/activity.service'
import {
  ActivityType,
  ActivityFileStatus,
  ActivityFileCheckStatus,
} from '../../activity/dto/create-activity.dto'
import { MessageService } from '../../message/services/message.service'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'

type S3UploadJobPayload = {
  resourceFileId: number
}

@Processor(LARGE_FILE_UPLOAD_QUEUE)
export class UploadProcessor {
  private readonly logger: Logger
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(GAME_STORAGE)
    private readonly s3Service: S3Service,
    private readonly activityService: ActivityService,
    private readonly messageService: MessageService,
  ) {
    this.logger = new Logger(UploadProcessor.name)
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Starting job ${job.id}(${job.name})`)
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id}(${job.name})`)
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Failed job ${job?.id}(${job?.name}): ${err?.message}`, err?.stack)
  }

  @Process({ name: S3_UPLOAD_JOB, concurrency: 2 })
  async processS3Upload(job: Job<S3UploadJobPayload>) {
    const { resourceFileId } = job.data

    const file = await this.prismaService.gameDownloadResourceFile.findUnique({
      where: {
        id: resourceFileId,
      },
      include: {
        game_download_resource: {
          select: {
            game_id: true,
          },
        },
      },
    })

    if (!file) {
      this.logger.warn(`resource file ${resourceFileId} not found, skip`)
      return
    }
    if (file.file_status === 3 && file.s3_file_key) {
      this.logger.log(`resource file ${resourceFileId} already on S3, skip`)
      return
    }
    if (file.file_check_status !== 1) {
      throw new Error(
        `resource file ${resourceFileId} not OK to upload (status=${file.file_check_status})`,
      )
    }

    const gameId = file.game_download_resource.game_id
    const meta = {
      file_id: resourceFileId,
      file_name: file.file_name,
      file_size: Number(file.file_size),
    }

    const localPath = file.file_path
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error(`local file not found for resource file ${resourceFileId}: ${localPath}`)
    }

    const base = path.basename(file.file_name).normalize('NFKC')
    const safeName = base.replace(/[^\p{L}\p{N}._-]+/gu, '_')
    const s3Key = `games/${gameId}/${resourceFileId}/${safeName}`

    const rs = fs.createReadStream(localPath)
    await this.s3Service.uploadFileStream(
      s3Key,
      rs,
      file.file_content_type || 'application/octet-stream',
      gameId,
      file.creator_id,
      file.file_hash,
    )

    await this.prismaService.$transaction(async tx => {
      const latestHistory = await tx.gameDownloadResourceFileHistory.findFirst({
        where: { file_id: resourceFileId },
        orderBy: { created: 'desc' },
        select: {
          id: true,
        },
      })
      if (latestHistory) {
        await tx.gameDownloadResourceFileHistory.update({
          where: { id: latestHistory.id },
          data: {
            s3_file_key: s3Key,
          },
        })
      } else {
        await tx.gameDownloadResourceFileHistory.create({
          data: {
            file_id: resourceFileId,
            file_size: file.file_size,
            hash_algorithm: file.hash_algorithm,
            file_hash: file.file_hash,
            s3_file_key: s3Key,
            reason: null,
            upload_session_id: file.upload_session_id,
            operator_id: file.creator_id,
          },
        })
      }

      await tx.gameDownloadResourceFile.update({
        where: { id: resourceFileId },
        data: {
          file_status: 3,
          s3_file_key: s3Key,
        },
      })
      await this.activityService.create(
        {
          type: ActivityType.FILE_UPLOAD_TO_S3,
          user_id: file.creator_id,
          game_id: gameId,
          file_id: resourceFileId,
          file_status: ActivityFileStatus.UPLOADED_TO_S3,
          file_check_status: ActivityFileCheckStatus.OK,
        },
        tx,
      )
      await this.messageService.send(
        {
          type: MessageType.SYSTEM,
          tone: MessageTone.SUCCESS,
          title: 'Messages.System.File.Upload.FileUploadSuccessTitle',
          content: 'Messages.System.File.Upload.FileUploadSuccessContent',
          game_id: gameId,
          meta,
          receiver_id: file.creator_id,
        },
        tx,
      )
      await tx.user.update({
        where: { id: file.creator_id },
        data: { upload_injected_file_times: 0 },
      })
    })

    try {
      await fs.promises.rm(localPath, { force: true })
    } catch {
      this.logger.warn(`failed to remove local temp file: ${localPath}`)
    }
  }
}
