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

  const issueInput = (overrides: Record<string, any> = {}) => ({
    fileId: 1,
    fileName: 'game.7z',
    bucketName: 'shionlib-games',
    fileKey: 'games/game.7z',
    authorizationToken: 'download-token',
    downloadUrl: 'https://f005.backblazeb2.com',
    expiresIn: 3600,
    gameId: 1,
    ...overrides,
  })

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

    const url = service.issueDownloadUrl(
      issueInput({
        fileId: 42,
      }),
    )

    expect(url).toMatch(/^https:\/\/dl\.example\.com\/dl\/42\/[^/?]+\?ticket=/)
  })

  it('encrypts ticket payload that can be decrypted with the same secret', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl(
      issueInput({
        fileId: 10,
        fileName: 'test.rar',
        fileKey: 'bucket/test.rar',
        authorizationToken: 'abc',
        expiresIn: 1800,
      }),
    )

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.v).toBe(3)
    expect(payload.fid).toBe(10)
    expect(payload.n).toBe('test.rar')
    expect(payload.mc).toBe(4)
    expect(payload.b).toBe('shionlib-games')
    expect(payload.k).toBe('bucket/test.rar')
    expect(payload.a).toBe('abc')
    expect(payload.u).toBe('https://f005.backblazeb2.com')
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(payload.sid).toBeDefined()
  })

  it('uses sid instead of fileName in the URL path', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl(
      issueInput({
        fileName: '[Frontwing] Corona Blossom.rar',
      }),
    )

    const pathnameParts = new URL(url).pathname.split('/')
    expect(pathnameParts).toHaveLength(4)
    expect(pathnameParts[1]).toBe('dl')
    expect(pathnameParts[2]).toBe('1')
    expect(pathnameParts[3]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('stores B2 download source fields in the ticket payload', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl(
      issueInput({
        fileId: 5,
        fileName: 'file.zip',
        bucketName: 'other-bucket',
        fileKey: 'deep/path/file.zip',
        authorizationToken: 'token-with-extra',
        downloadUrl: 'https://f123.backblazeb2.com',
      }),
    )

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.b).toBe('other-bucket')
    expect(payload.k).toBe('deep/path/file.zip')
    expect(payload.a).toBe('token-with-extra')
    expect(payload.u).toBe('https://f123.backblazeb2.com')
  })

  it('normalizes proxy_worker_host with trailing slash', () => {
    const { service } = createService({
      'file_download.proxy_worker_host': 'https://dl.example.com/',
    })

    const url = service.issueDownloadUrl(issueInput())

    expect(url).toMatch(/^https:\/\/dl\.example\.com\/dl\/1\/[^/?]+/)
    expect(url).not.toContain('//dl/')
  })

  it('keeps sid in URL path consistent with encrypted payload', () => {
    const { service } = createService()

    const url = service.issueDownloadUrl(
      issueInput({
        fileId: 7,
      }),
    )

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')
    const [, , fileIdFromPath, sidFromPath] = new URL(url).pathname.split('/')

    expect(fileIdFromPath).toBe('7')
    expect(decodeURIComponent(sidFromPath)).toBe(payload.sid)
  })

  it('throws when proxy_worker_host is empty', () => {
    const { service } = createService({
      'file_download.proxy_worker_host': '',
    })

    expect(() => service.issueDownloadUrl(issueInput())).toThrow(
      'FILE_DOWNLOAD_PROXY_WORKER_HOST is required',
    )
  })

  it('throws when ticket_secret is empty', () => {
    const { service } = createService({
      'file_download.ticket_secret': '',
    })

    expect(() => service.issueDownloadUrl(issueInput())).toThrow(
      'FILE_DOWNLOAD_TICKET_SECRET is required',
    )
  })

  it('uses max_conns from config in ticket payload', () => {
    const { service } = createService({
      'file_download.max_conns': 8,
    })

    const url = service.issueDownloadUrl(issueInput())

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.mc).toBe(8)
  })

  it('sets mc to 1 when max_conns is less than 1', () => {
    const { service } = createService({
      'file_download.max_conns': 0,
    })

    const url = service.issueDownloadUrl(issueInput())

    const ticket = decodeURIComponent(new URL(url).searchParams.get('ticket')!)
    const payload = decryptTicket(ticket, 'test-secret-key')

    expect(payload.mc).toBe(1)
  })
})
