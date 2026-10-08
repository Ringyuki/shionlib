import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { nameTaken, rename, saveBio, uploadAvatar, uploadCover } from './settings.use-cases'

const picture = () => new File(['image'], 'a.png', { type: 'image/png' })

describe('pictures', () => {
  it('uploads the avatar and the cover under their own fields', async () => {
    const fake = fakeApi()
      .on('post', '/user/info/avatar', { key: 'user/1/avatar/a.webp' })
      .on('post', '/user/info/cover', { key: 'user/1/cover/c.webp' })
    await expect(uploadAvatar(fake.api, picture())).resolves.toEqual({
      key: 'user/1/avatar/a.webp',
    })
    await uploadCover(fake.api, picture())
    expect((await fake.requests[0]?.formData())?.get('avatar')).toBeInstanceOf(File)
    expect((await fake.requests[1]?.formData())?.get('cover')).toBeInstanceOf(File)
  })

  it('lets a rejected picture fail the command', async () => {
    const fake = fakeApi().fail('post', '/user/info/avatar', 422, {
      code: 480103,
      message: 'unsupported',
    })
    await expect(uploadAvatar(fake.api, picture())).rejects.toMatchObject({ status: 422 })
  })
})

describe('name', () => {
  it('checks and saves the trimmed name', async () => {
    const fake = fakeApi()
      .on('post', '/user/check-name', { exists: true })
      .on('post', '/user/info/name', { name: 'kotori' })
    await expect(nameTaken(fake.api, { name: ' kotori ' })).resolves.toBe(true)
    await rename(fake.api, { name: ' kotori ' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ name: 'kotori' })
    await expect(fake.requests[1]?.json()).resolves.toEqual({ name: 'kotori' })
  })
})

describe('saveBio', () => {
  it('saves the trimmed bio, also an empty one', async () => {
    const fake = fakeApi().on('post', '/user/info/bio', { bio: '' })
    await saveBio(fake.api, { bio: '  ' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ bio: '' })
  })
})
