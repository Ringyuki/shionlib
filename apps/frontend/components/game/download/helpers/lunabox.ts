type ArchiveFormat =
  | 'none'
  | 'zip'
  | 'rar'
  | '7z'
  | 'tar'
  | 'tar.gz'
  | 'tar.bz2'
  | 'tar.xz'
  | 'tar.zst'
  | 'tgz'
  | 'tbz2'
  | 'txz'
  | 'tzst'

const getArchiveFormat = (fileName: string): ArchiveFormat => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz'
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2'
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) return 'tar.xz'
  if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst')) return 'tar.zst'
  if (lower.endsWith('.tar')) return 'tar'
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.rar')) return 'rar'
  if (lower.endsWith('.7z')) return '7z'
  return 'none'
}

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

export const openLunaBox = (lunaBoxUrl: string): void => {
  const a = document.createElement('a')
  a.href = lunaBoxUrl
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
