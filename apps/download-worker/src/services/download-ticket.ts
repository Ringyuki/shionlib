import { decodeBase64Url } from '../helpers/base64'
import type { DownloadProxyTicketPayload } from '../types/download-proxy-ticket'

const aesKeyCache = new Map<string, Promise<CryptoKey>>()

export const decryptTicket = async (ticket: string, secret: string) => {
  try {
    const [ivRaw, ciphertextRaw, authTagRaw] = ticket.split('.')
    if (!ivRaw || !ciphertextRaw || !authTagRaw || !secret) {
      return null
    }

    const iv = decodeBase64Url(ivRaw)
    const ciphertext = decodeBase64Url(ciphertextRaw)
    const authTag = decodeBase64Url(authTagRaw)
    const encrypted = new Uint8Array(ciphertext.length + authTag.length)
    encrypted.set(ciphertext, 0)
    encrypted.set(authTag, ciphertext.length)

    const key = await getAesKey(secret)
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      encrypted,
    )

    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as DownloadProxyTicketPayload
    if (payload.v !== 3) return null

    return payload
  } catch {
    return null
  }
}

const getAesKey = (secret: string) => {
  let cached = aesKeyCache.get(secret)
  if (!cached) {
    cached = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(secret))
      .then(hash => crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt']))
    aesKeyCache.set(secret, cached)
  }

  return cached
}
