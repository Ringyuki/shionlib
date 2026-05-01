import { Injectable } from '@nestjs/common'
import { createCipheriv, createHash, randomBytes, randomUUID as nodeRandomUUID } from 'node:crypto'
import { ShionConfigService } from '../../../common/config/services/config.service'
import type {
  DownloadProxyTicketPayload,
  IssueDownloadProxyUrlInput,
} from '../types/DownloadProxy.type'

@Injectable()
export class DownloadProxyTicketService {
  constructor(private readonly configService: ShionConfigService) {}

  issueDownloadUrl(input: IssueDownloadProxyUrlInput) {
    const payload: DownloadProxyTicketPayload = {
      v: 3,
      sid: globalThis.crypto?.randomUUID?.() ?? nodeRandomUUID(),
      fid: input.fileId,
      n: input.fileName,
      exp: Math.floor(Date.now() / 1000) + input.expiresIn,
      mc: Math.max(1, this.configService.get('file_download.max_conns')),
      b: input.bucketName,
      k: input.fileKey,
      a: input.authorizationToken,
      u: input.downloadUrl,
      gid: input.gameId,
    }

    const ticket = this.encryptPayload(payload)
    return this.buildProxyUrl(input.fileId, payload.sid, ticket)
  }

  private buildProxyUrl(fileId: number, sessionId: string, ticket: string) {
    const baseUrl = this.normalizeBaseUrl(this.configService.get('file_download.proxy_worker_host'))
    if (!baseUrl) {
      throw new Error('FILE_DOWNLOAD_PROXY_WORKER_HOST is required when FILE_DOWNLOAD_MODE=worker')
    }

    return `${baseUrl}/dl/${fileId}/${encodeURIComponent(sessionId)}?ticket=${encodeURIComponent(ticket)}`
  }

  private encryptPayload(payload: DownloadProxyTicketPayload) {
    const secret = this.configService.get('file_download.ticket_secret')
    if (!secret) {
      throw new Error('FILE_DOWNLOAD_TICKET_SECRET is required when FILE_DOWNLOAD_MODE=worker')
    }

    const iv = randomBytes(12)
    const key = createHash('sha256').update(secret).digest()
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const authTag = cipher.getAuthTag()

    return `${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${authTag.toString('base64url')}`
  }

  private normalizeBaseUrl(url: string) {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }
}
