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

export const getArchiveFormat = (fileName: string): ArchiveFormat => {
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

export const openProtocolUrl = (protocolUrl: string): void => {
  const a = document.createElement('a')
  a.href = protocolUrl
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
