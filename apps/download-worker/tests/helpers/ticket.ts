import type { DownloadProxyTicketPayload } from '../../src/types/download-proxy-ticket'

const encodeBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export const encryptTicket = async (payload: DownloadProxyTicketPayload, secret: string) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  )

  return [iv, encrypted.slice(0, -16), encrypted.slice(-16)].map(encodeBase64Url).join('.')
}
