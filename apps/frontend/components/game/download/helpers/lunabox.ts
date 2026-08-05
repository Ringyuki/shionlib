import { getArchiveFormat } from './protocol'

interface LunaBoxParams {
  url: string
  fileName: string
  size: number
  checksumAlgo: 'sha256' | 'blake3'
  checksum: string
  expiresAt: number
  title?: string
  hikarinagiId?: number
}

export const buildLunaBoxUrl = ({
  url,
  fileName,
  size,
  checksumAlgo,
  checksum,
  expiresAt,
  title,
  hikarinagiId,
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
  if (hikarinagiId) {
    params.set('source', 'hikarinagi')
    params.set('meta_source', 'hikarinagi')
    params.set('meta_id', String(hikarinagiId))
  }

  return `lunabox://install?${params.toString()}`
}
