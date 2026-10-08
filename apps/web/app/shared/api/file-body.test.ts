import { describe, expect, it } from 'vitest'
import { fileBody } from './file-body'
import { fakeApi } from './testing'

describe('fileBody', () => {
  it('sends the file as a multipart field', async () => {
    const fake = fakeApi().on('post', '/user/info/avatar', { key: 'user/1/avatar/a.webp' })
    const file = new File(['image'], 'a.png', { type: 'image/png' })
    await expect(fake.api.post('/user/info/avatar', fileBody('avatar', file))).resolves.toEqual({
      key: 'user/1/avatar/a.webp',
    })
    const [request] = fake.requests
    expect(request?.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/)
    const sent = (await request?.formData())?.get('avatar')
    expect(sent).toBeInstanceOf(File)
    expect(sent instanceof File ? [sent.name, sent.type, sent.size] : []).toEqual([
      'a.png',
      'image/png',
      5,
    ])
  })
})
