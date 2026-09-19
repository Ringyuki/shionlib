import { of } from 'rxjs'
import { MoyuClient } from './moyu.client'

describe('MoyuClient', () => {
  const createClient = (items: unknown[] = []) => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: { object: 'list', items, missing: [] } })),
    }
    const config = {
      get: jest.fn((key: string) =>
        key === 'nextmoe.baseUrl' ? 'https://api.nextmoe.test/' : 'nmk_test_key',
      ),
    }
    const client = new MoyuClient(httpService as never, config as never)

    return { client, httpService }
  }

  it('looks the game up by its vndb ref with resources and publishers, nsfw pages included', async () => {
    const { client, httpService } = createClient()

    await client.patchByVndbId('v4145')

    const [url, options] = httpService.get.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://api.nextmoe.test/v2/moyu/patches')
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      refs: 'vndb:v4145',
      nsfw: 'true',
      include: 'resources,publisher',
    })
    expect(options.headers).toEqual({ Authorization: 'Bearer nmk_test_key' })
  })

  it('answers the first page moyu returns for the ref', async () => {
    const { client } = createClient([{ id: '11617' }, { id: '223309' }])

    await expect(client.patchByVndbId('v4145')).resolves.toEqual({ id: '11617' })
  })

  it('answers null when the ref is missing on moyu', async () => {
    const { client } = createClient()

    await expect(client.patchByVndbId('v999999')).resolves.toBeNull()
  })
})
