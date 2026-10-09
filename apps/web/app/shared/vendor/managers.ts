export const managers = ['lunabox', 'reina', 'potatovn'] as const

export type Manager = (typeof managers)[number]

export type ManagerInstall = {
  url: string
  expiresAt: number
  resourceId: number
  fileName: string
  size: number
  checksumAlgorithm: 'sha256' | 'blake3'
  checksum: string
  title: string
  bangumiId: string | null
  vndbId: string | null
  hikarinagiId: number | null
}

export const managerNames: Record<Manager, string> = {
  lunabox: 'LunaBox',
  reina: 'ReinaManager',
  potatovn: 'PotatoVN',
}

export const managerSites: Record<Manager, string> = {
  lunabox: 'https://box.lunarain.site',
  reina: 'https://reina.huoshen80.top',
  potatovn: 'https://potatovn.net',
}

export const managerLogos: Record<Manager, string> = {
  lunabox: '/brand/lunabox.webp',
  reina: '/brand/reina.webp',
  potatovn: '/brand/potatovn.webp',
}

const schemes: Record<Manager, string> = {
  lunabox: 'lunabox',
  reina: 'reinamanager',
  potatovn: 'potato-vn',
}

const provider = 'shionlib'

const archiveEndings: readonly (readonly [string, string])[] = [
  ['.tar.gz', 'tar.gz'],
  ['.tgz', 'tar.gz'],
  ['.tar.bz2', 'tar.bz2'],
  ['.tbz2', 'tar.bz2'],
  ['.tar.xz', 'tar.xz'],
  ['.txz', 'tar.xz'],
  ['.tar.zst', 'tar.zst'],
  ['.tzst', 'tar.zst'],
  ['.tar', 'tar'],
  ['.zip', 'zip'],
  ['.rar', 'rar'],
  ['.7z', '7z'],
]

export function isManager(value: string): value is Manager {
  return managers.some(manager => manager === value)
}

export function needsBangumi(manager: Manager): boolean {
  return manager !== 'lunabox'
}

export function archiveFormat(fileName: string): string {
  const name = fileName.toLowerCase()
  return archiveEndings.find(([ending]) => name.endsWith(ending))?.[1] ?? 'none'
}

function fileParams(install: ManagerInstall): Record<string, string> {
  return {
    url: install.url,
    file_name: install.fileName,
    archive_format: archiveFormat(install.fileName),
    size: String(install.size),
    checksum_algo: install.checksumAlgorithm,
    checksum: install.checksum,
    expires_at: String(install.expiresAt),
  }
}

function lunaboxParams(install: ManagerInstall): URLSearchParams {
  const params = new URLSearchParams({ ...fileParams(install), download_source: provider })
  if (install.title !== '') {
    params.set('title', install.title)
  }
  if (install.hikarinagiId !== null) {
    params.set('source', 'hikarinagi')
    params.set('meta_source', 'hikarinagi')
    params.set('meta_id', String(install.hikarinagiId))
  }
  return params
}

function installParams(install: ManagerInstall, bangumiId: string): URLSearchParams {
  const params = new URLSearchParams({
    v: '1',
    provider,
    resource_id: String(install.resourceId),
    ...fileParams(install),
    bgm_id: bangumiId,
    title: install.title,
  })
  if (install.vndbId !== null && install.vndbId !== '') {
    params.set('vndb_id', install.vndbId.startsWith('v') ? install.vndbId : `v${install.vndbId}`)
  }
  if (install.hikarinagiId !== null) {
    params.set('hikarinagi_id', String(install.hikarinagiId))
  }
  return params
}

export function managerUrl(manager: Manager, install: ManagerInstall): string | undefined {
  if (!needsBangumi(manager)) {
    return `${schemes[manager]}://install?${lunaboxParams(install)}`
  }
  if (install.bangumiId === null || install.bangumiId === '') {
    return undefined
  }
  return `${schemes[manager]}://install?${installParams(install, install.bangumiId)}`
}

export function openManager(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}
