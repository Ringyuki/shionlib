import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { loadAllowance, removeFile, renameFile } from './resource.use-cases'

describe('renameFile', () => {
  it('sends the trimmed name of the file', async () => {
    const fake = fakeApi().on('patch', '/game/download-source/file/{fileId}', undefined)
    await renameFile(fake.api, { fileId: 12, name: '  game.part1.rar ' })
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/game/download-source/file/12')
    await expect(request?.json()).resolves.toEqual({ file_name: 'game.part1.rar' })
  })

  it('lets the reason through when the name is taken', async () => {
    const fake = fakeApi().fail('patch', '/game/download-source/file/{fileId}', 409, {
      code: 440106,
      message: 'duplicate',
    })
    await expect(renameFile(fake.api, { fileId: 12, name: 'a.rar' })).rejects.toMatchObject({
      status: 409,
      message: 'duplicate',
    })
  })
})

describe('removeFile', () => {
  it('removes the file by its id', async () => {
    const fake = fakeApi().on('delete', '/game/download-source/file/{fileId}', undefined)
    await removeFile(fake.api, { fileId: 7 })
    const [request] = fake.requests
    expect(request?.method).toBe('DELETE')
    expect(new URL(request?.url ?? '').pathname).toBe('/game/download-source/file/7')
  })
})

describe('loadAllowance', () => {
  it('has none for a guest', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 401, { code: 200101, message: 'sign in' })
    await expect(loadAllowance(fake.api)).resolves.toBeNull()
  })

  it('lets other failures through', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 500, { code: 500, message: 'failed' })
    await expect(loadAllowance(fake.api)).rejects.toMatchObject({ status: 500 })
  })
})
