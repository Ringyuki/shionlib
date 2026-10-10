import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { uploadDocumentPicture } from './media.use-cases'

const picture = () => new File(['image'], 'map.png', { type: 'image/png' })

describe('document pictures', () => {
  it('uploads the file and answers with the stored key and size', async () => {
    const stored = { key: 'richtext/1/a.webp', width: 1280, height: 720 }
    const fake = fakeApi().on('put', '/uploads/small/richtext/image', stored)
    await expect(uploadDocumentPicture(fake.api, picture())).resolves.toEqual(stored)
    expect((await fake.requests[0]?.formData())?.get('file')).toBeInstanceOf(File)
  })

  it('lets a refused picture fail the command', async () => {
    const fake = fakeApi().fail('put', '/uploads/small/richtext/image', 413, {
      code: 480102,
      message: 'too large',
    })
    await expect(uploadDocumentPicture(fake.api, picture())).rejects.toMatchObject({ status: 413 })
  })
})
