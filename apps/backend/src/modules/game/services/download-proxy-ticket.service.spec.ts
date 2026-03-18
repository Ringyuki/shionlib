import { createDecipheriv, createHash } from 'node:crypto'
import { DownloadProxyTicketService } from './download-proxy-ticket.service'
import type { DownloadProxyTicketPayload } from '../types/DownloadProxy.type'

describe('DownloadProxyTicketService', () => {
  const createService = (overrides: Record<string, any> = {}) => {
    const configValues = new Map<string, any>([
      ['file_download.proxy_worker_host', 'https://dl.example.com'],
      ['file_download.ticket_secret', 'test-secret-key'],
      ['file_download.max_conns', 4],
      ...Object.entries(overrides),
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }

    const service = new DownloadProxyTicketService(configService as any)
    return { service, configService, configValues }
  }

  const decryptTicket = (ticket: string, secret: string): DownloadProxyTicketPayload => {
    const [ivRaw, ciphertextRaw, authTagRaw] = ticket.split('.')
    const iv = Buffer.from(ivRaw, 'base64url')
    const ciphertext = Buffer.from(ciphertextRaw, 'base64url')
    const authTag = Buffer.from(authTagRaw, 'base64url')
    const key = createHash('sha256').update(secret).digest()
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(plaintext.toString('utf8'))
  }

  it('issueDownloadUrl returns a well-formed proxy URL with encrypted ticket', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl({
      fileId: 42,
      fileName: 'game.7z',
      originUrl: 'https://cdn.example.com/files/game.7z?Authorization=token123',
      expiresIn: 3600,
    })

    expect(url).toMatch(/^https:\/\/dl\.example\.com\/dl\/42\/game\.7z\?ticket=/)
  })

  it('encrypts ticket payload that can be decrypted with the same secret', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl({
      fileId: 10,
      fileName: 'test.rar',
      originUrl: 'https://cdn.example.com/bucket/test.rar?Authorization=abc',
      expiresIn: 1800,
    })

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.v).toBe(1)
    expect(payload.fid).toBe(10)
    expect(payload.n).toBe('test.rar')
    expect(payload.mc).toBe(4)
    expect(payload.p).toBe('/bucket/test.rar?Authorization=abc')
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(payload.sid).toBeDefined()
  })

  it('encodes fileName in the URL path', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl({
      fileId: 1,
      fileName: '[Frontwing] Corona Blossom.rar',
      originUrl: 'https://cdn.example.com/files/game.rar?Auth=x',
      expiresIn: 3600,
    })

    expect(url).toContain('/dl/1/%5BFrontwing%5D%20Corona%20Blossom.rar')
  })

  it('strips origin host and keeps only path + search in ticket', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl({
      fileId: 5,
      fileName: 'file.zip',
      originUrl: 'https://cdn.example.com/deep/path/file.zip?token=abc&extra=1',
      expiresIn: 3600,
    })

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.p).toBe('/deep/path/file.zip?token=abc&extra=1')
  })

  it('normalizes proxy_worker_host with trailing slash', () => {
    const { service } = createService({
      'file_download.proxy_worker_host': 'https://dl.example.com/',
    })

    const url = service.issueDownloadUrl({
      fileId: 1,
      fileName: 'game.7z',
      originUrl: 'https://cdn.example.com/file?Auth=x',
      expiresIn: 3600,
    })

    expect(url).toMatch(/^https:\/\/dl\.example\.com\/dl\/1\//)
    expect(url).not.toContain('//dl/')
  })

  it('throws when proxy_worker_host is empty', () => {
    const { service } = createService({
      'file_download.proxy_worker_host': '',
    })

    expect(() =>
      service.issueDownloadUrl({
        fileId: 1,
        fileName: 'game.7z',
        originUrl: 'https://cdn.example.com/file?Auth=x',
        expiresIn: 3600,
      }),
    ).toThrow('FILE_DOWNLOAD_PROXY_WORKER_HOST is required')
  })

  it('throws when ticket_secret is empty', () => {
    const { service } = createService({
      'file_download.ticket_secret': '',
    })

    expect(() =>
      service.issueDownloadUrl({
        fileId: 1,
        fileName: 'game.7z',
        originUrl: 'https://cdn.example.com/file?Auth=x',
        expiresIn: 3600,
      }),
    ).toThrow('FILE_DOWNLOAD_TICKET_SECRET is required')
  })

  it('uses max_conns from config in ticket payload', () => {
    const { service } = createService({
      'file_download.max_conns': 8,
    })

    const url = service.issueDownloadUrl({
      fileId: 1,
      fileName: 'game.7z',
      originUrl: 'https://cdn.example.com/file?Auth=x',
      expiresIn: 3600,
    })

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.mc).toBe(8)
  })

  it('sets mc to 1 when max_conns is less than 1', () => {
    const { service } = createService({
      'file_download.max_conns': 0,
    })

    const url = service.issueDownloadUrl({
      fileId: 1,
      fileName: 'game.7z',
      originUrl: 'https://cdn.example.com/file?Auth=x',
      expiresIn: 3600,
    })

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.mc).toBe(1)
  })
})
