import { getArchiveFormat } from './protocol'

interface LunaBoxParams {
  url: string
  fileName: string
  size: number
  checksumAlgo: 'sha256' | 'blake3'
  checksum: string
  expiresAt: number
  title?: string
  bangumiId?: string
}

export const buildLunaBoxUrl = ({
  url,
  fileName,
  size,
  checksumAlgo,
  checksum,
  expiresAt,
  title,
  bangumiId,
}: LunaBoxParams): string => {
  const params = new URLSearchParams({
    url,
    file_name: fileName,
    archive_format: getArchiveFormat(fileName),
    size: String(size),
    checksum_algo: checksumAlgo,
    checksum,
    expires_at: String(expiresAt),
    download_source: 'shionlib',
  })

  if (title) params.set('title', title)
  if (bangumiId) {
    params.set('source', 'bangumi')
    params.set('meta_source', 'bangumi')
    params.set('meta_id', bangumiId)
  }

  return `lunabox://install?${params.toString()}`
}
