import { getArchiveFormat } from './protocol'

interface ReinaParams {
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
}

const ensureVndbPrefix = (vndbId: string) => (vndbId.startsWith('v') ? vndbId : `v${vndbId}`)

export const buildReinaUrl = ({
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
}: ReinaParams): string => {
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

  return `reinamanager://install?${params.toString()}`
}
