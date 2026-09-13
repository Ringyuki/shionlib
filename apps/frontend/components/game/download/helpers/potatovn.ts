import { getArchiveFormat } from './protocol'

// PotatoVN (PotatoDownload plugin) accepts the same install protocol (v1) as ReinaManager,
// only the URL scheme differs.
interface PotatoVNParams {
  resourceId: number
  url: string
  fileName: string
  size: number
  checksumAlgo: 'sha256' | 'blake3'
  checksum: string
  expiresAt: number
  title: string
  bangumiId: string
  vndbId?: string
  hikarinagiId?: number
}

const ensureVndbPrefix = (vndbId: string) => (vndbId.startsWith('v') ? vndbId : `v${vndbId}`)

export const buildPotatoVNUrl = ({
  resourceId,
  url,
  fileName,
  size,
  checksumAlgo,
  checksum,
  expiresAt,
  title,
  bangumiId,
  vndbId,
  hikarinagiId,
}: PotatoVNParams): string => {
  const params = new URLSearchParams({
    v: '1',
    provider: 'shionlib',
    resource_id: String(resourceId),
    url,
    file_name: fileName,
    archive_format: getArchiveFormat(fileName),
    size: String(size),
    checksum_algo: checksumAlgo,
    checksum,
    expires_at: String(expiresAt),
    bgm_id: bangumiId,
    title,
  })

  if (vndbId) params.set('vndb_id', ensureVndbPrefix(vndbId))
  if (hikarinagiId) params.set('hikarinagi_id', String(hikarinagiId))

  return `potato-vn://install?${params.toString()}`
}
