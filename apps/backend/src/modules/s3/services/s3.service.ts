import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'node:stream'

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger: Logger
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucket: string,
  ) {
    this.logger = new Logger(S3Service.name)
  }

  async onModuleInit() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
      })
      this.s3Client.send(command)
      this.logger.log(`S3 client initialized successfully for bucket ${this.bucket}`)
    } catch (error) {
      this.logger.error(error)
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    })
    const result = await this.s3Client.send(command)
    return result
  }

  async uploadFileStream(
    key: string,
    stream: Readable,
    contentType: string,
    game_id?: number,
    uploader_id?: number,
    file_hash?: string,
  ) {
    const metadata: Record<string, string> = {}
    if (game_id) metadata['game-id'] = game_id.toString()
    if (uploader_id) metadata['uploader-id'] = uploader_id.toString()
    if (file_hash) metadata['file-sha256'] = file_hash
    const uploader = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
        Metadata: metadata,
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 32,
      leavePartsOnError: false,
    })
    return uploader.done()
  }

  async getFile(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    const result = await this.s3Client.send(command)
    return result
  }

  async deleteFile(key: string, hard: boolean = true) {
    if (hard) {
      const { versions, deleteMarkers } = await this.listObjectVersions(key)
      const allIds = [...versions, ...deleteMarkers]
      if (allIds.length === 0) return
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: allIds.map(id => ({ Key: key, VersionId: id })),
          Quiet: true,
        },
      })
      await this.s3Client.send(command)
    } else {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      await this.s3Client.send(command)
    }
  }

  private async listObjectVersions(key: string) {
    const command = new ListObjectVersionsCommand({
      Bucket: this.bucket,
      Prefix: key,
    })
    const result = await this.s3Client.send(command)

    const versions = (result.Versions || []).filter(v => v.Key === key).map(v => v.VersionId)
    const deleteMarkers = (result.DeleteMarkers || [])
      .filter(m => m.Key === key)
      .map(m => m.VersionId)

    return { versions, deleteMarkers }
  }

  async getFileList(options?: { prefix?: string; continuationToken?: string; maxKeys?: number }) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: options?.prefix,
      ContinuationToken: options?.continuationToken,
      MaxKeys: options?.maxKeys,
    })
    const result = await this.s3Client.send(command)
    return result
  }
}
