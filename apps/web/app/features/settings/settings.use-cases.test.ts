import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { nameTaken, rename } from './settings.use-cases'

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
