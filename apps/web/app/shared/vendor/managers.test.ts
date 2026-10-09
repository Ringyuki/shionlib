import { describe, expect, it } from 'vitest'
import { archiveFormat, isManager, managerUrl, needsBangumi, type ManagerInstall } from './managers'

const install: ManagerInstall = {
  url: 'https://dl.example/dl/7/s?ticket=a%2Fb',
  expiresAt: 1_800_000_000,
  resourceId: 12,
  fileName: 'Game Disc 1.7z',
  size: 4096,
  checksumAlgorithm: 'blake3',
  checksum: 'abc123',
  title: '千恋＊万花',
  bangumiId: '172612',
  vndbId: '19829',
  hikarinagiId: 9,
}

const paramsOf = (url: string | undefined) =>
  Object.fromEntries(new URL(url ?? 'none://none').searchParams)

describe('archiveFormat', () => {
  it('names the archive by the end of the file name', () => {
    expect(archiveFormat('Game.TAR.GZ')).toBe('tar.gz')
    expect(archiveFormat('game.tgz')).toBe('tar.gz')
    expect(archiveFormat('game.tar.zst')).toBe('tar.zst')
    expect(archiveFormat('game.tar')).toBe('tar')
    expect(archiveFormat('game.zip')).toBe('zip')
    expect(archiveFormat('game.rar')).toBe('rar')
    expect(archiveFormat('game.7z')).toBe('7z')
    expect(archiveFormat('game.exe')).toBe('none')
  })
})

describe('managers', () => {
  it('knows its three managers and which of them go by Bangumi', () => {
    expect(isManager('lunabox')).toBe(true)
    expect(isManager('aria2')).toBe(false)
    expect(needsBangumi('lunabox')).toBe(false)
    expect(needsBangumi('reina')).toBe(true)
    expect(needsBangumi('potatovn')).toBe(true)
  })
})

describe('managerUrl', () => {
  it('hands LunaBox the file and the Hikarinagi entry', () => {
    const url = managerUrl('lunabox', install)
    expect(url?.startsWith('lunabox://install?')).toBe(true)
    expect(paramsOf(url)).toEqual({
      url: install.url,
      file_name: 'Game Disc 1.7z',
      archive_format: '7z',
      size: '4096',
      checksum_algo: 'blake3',
      checksum: 'abc123',
      expires_at: '1800000000',
      download_source: 'shionlib',
      title: '千恋＊万花',
      source: 'hikarinagi',
      meta_source: 'hikarinagi',
      meta_id: '9',
    })
  })

  it('leaves out what LunaBox was not given', () => {
    const params = paramsOf(managerUrl('lunabox', { ...install, title: '', hikarinagiId: null }))
    expect(params.title).toBeUndefined()
    expect(params.meta_id).toBeUndefined()
  })

  it('hands ReinaManager and PotatoVN the same install request under their own schemes', () => {
    const reina = managerUrl('reina', install)
    const potato = managerUrl('potatovn', install)
    expect(reina?.startsWith('reinamanager://install?')).toBe(true)
    expect(potato?.startsWith('potato-vn://install?')).toBe(true)
    expect(paramsOf(reina)).toEqual(paramsOf(potato))
    expect(paramsOf(reina)).toEqual({
      v: '1',
      provider: 'shionlib',
      resource_id: '12',
      url: install.url,
      file_name: 'Game Disc 1.7z',
      archive_format: '7z',
      size: '4096',
      checksum_algo: 'blake3',
      checksum: 'abc123',
      expires_at: '1800000000',
      bgm_id: '172612',
      title: '千恋＊万花',
      vndb_id: 'v19829',
      hikarinagi_id: '9',
    })
  })

  it('keeps a VNDB id that already has its prefix and drops ids that are missing', () => {
    const params = paramsOf(managerUrl('reina', { ...install, vndbId: 'v7', hikarinagiId: null }))
    expect(params.vndb_id).toBe('v7')
    expect(params.hikarinagi_id).toBeUndefined()
    expect(paramsOf(managerUrl('reina', { ...install, vndbId: null })).vndb_id).toBeUndefined()
  })

  it('has nothing to hand over when a manager that goes by Bangumi gets no Bangumi id', () => {
    expect(managerUrl('reina', { ...install, bangumiId: null })).toBeUndefined()
    expect(managerUrl('potatovn', { ...install, bangumiId: '' })).toBeUndefined()
    expect(managerUrl('lunabox', { ...install, bangumiId: null })).toBeDefined()
  })
})
