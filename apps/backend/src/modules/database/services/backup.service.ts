import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { spawn } from 'child_process'
import { BACKUP_STORAGE } from '../../s3/constants/s3.constants'
import { S3Service } from '../../s3/services/s3.service'
import { Inject } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { Readable } from 'stream'
import type { _Object } from '@aws-sdk/client-s3'
import type { BackupTier } from '../types/backup'

@Injectable()
export class BackupService {
  private readonly logger: Logger
  private readonly dailyPrefix = 'backup/database/daily/'
  private readonly weeklyPrefix = 'backup/database/weekly/'

  constructor(
    @Inject(BACKUP_STORAGE) private readonly backupStorage: S3Service,
    private readonly configService: ShionConfigService,
  ) {
    this.logger = new Logger(BackupService.name)
  }

  private get databaseUrl() {
    return this.configService.get('database.url')
  }
  private get enableBackup() {
    return this.configService.get('database.enable_backup')
  }
  private get retentionDaily() {
    return this.configService.get('database.backup_retention_daily') ?? 7
  }
  private get retentionWeekly() {
    return this.configService.get('database.backup_retention_weekly') ?? 4
  }

  async dumpDatabase() {
    if (!this.enableBackup) return
    if (!this.databaseUrl) {
      this.logger.error('Database URL is not set')
      throw new InternalServerErrorException('Database URL is not set')
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let stderr = ''

      const pgDump = spawn(
        'pg_dump',
        ['--format=custom', '--encoding=UTF8', '--no-owner', '--no-privileges', this.databaseUrl],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )

      pgDump.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      pgDump.stderr.on('data', (data: Buffer) => {
        const msg = data.toString()
        stderr += msg
      })

      pgDump.on('error', err => {
        this.logger.error(`Failed to start pg_dump: ${err.message}`)
        reject(new InternalServerErrorException('Failed to start pg_dump'))
      })

      pgDump.on('close', code => {
        if (code === 0) {
          this.logger.log('pg_dump finished successfully')
          resolve(Buffer.concat(chunks))
        } else {
          this.logger.error(`pg_dump exited with code ${code}: ${stderr}`)
          reject(new InternalServerErrorException(`pg_dump failed with code ${code}`))
        }
      })
    })
  }

  async backupToS3(tier: BackupTier = 'daily') {
    if (!this.enableBackup) {
      this.logger.log('Database backup is disabled')
      return
    }
    if (!this.backupStorage) {
      this.logger.error('Backup storage is not set')
      throw new InternalServerErrorException('Backup storage is not set')
    }

    const backupFile = await this.dumpDatabase()
    if (!backupFile) {
      this.logger.error('Failed to dump database')
      throw new InternalServerErrorException('Failed to dump database')
    }

    const prefix = tier === 'weekly' ? this.weeklyPrefix : this.dailyPrefix
    const retention = tier === 'weekly' ? this.retentionWeekly : this.retentionDaily
    const date = new Date().toISOString().replace(/:/g, '-')
    const key = `${prefix}${date}.shionlibbackup`

    const uploadResult = await this.backupStorage.uploadFileStream(
      key,
      Readable.from(backupFile),
      'application/octet-stream',
    )

    await this.cleanupOldBackups(key, prefix, retention)

    return uploadResult
  }

  private async cleanupOldBackups(latestKey: string, prefix: string, retention: number) {
    if (!retention || retention <= 0) return

    try {
      const backups = await this.listBackupObjects(prefix)
      if (backups.length <= retention) return

      const sorted = backups.sort((a, b) => {
        const aTime = a.LastModified?.getTime() ?? 0
        const bTime = b.LastModified?.getTime() ?? 0
        return bTime - aTime
      })

      const toDelete = sorted.slice(retention)
      for (const item of toDelete) {
        if (!item.Key || item.Key === latestKey) continue
        await this.backupStorage.deleteFile(item.Key, false)
        this.logger.log(`Deleted old backup ${item.Key}`)
      }
    } catch (error) {
      this.logger.error('Failed to prune old backups', error as Error)
    }
  }

  private async listBackupObjects(prefix: string) {
    const objects: _Object[] = []
    let continuationToken: string | undefined

    do {
      const result = await this.backupStorage.getFileList({
        prefix,
        continuationToken,
      })
      if (result.Contents?.length)
        objects.push(...result.Contents.filter(item => item.Key?.startsWith(prefix)))
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
    } while (continuationToken)

    return objects
  }
}
