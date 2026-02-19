import { of, throwError } from 'rxjs'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { VNDBService } from './vndb.service'

describe('VNDBService', () => {
  const createService = () => {
    const httpService = {
      post: jest.fn(),
    }
    const service = new VNDBService(httpService as any)
    return { httpService, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('vndbRequest(single) returns first result and uses default vn path', async () => {
    const { service, httpService } = createService()
    httpService.post.mockReturnValueOnce(
      of({
        data: {
          results: [{ id: 'v1' }, { id: 'v2' }],
        },
      }),
    )

    await expect(
      service.vndbRequest('single', ['id', '=', 'v1'], ['id', 'title']),
    ).resolves.toEqual({ id: 'v1' })
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.vndb.org/kana/vn',
      {
        filters: ['id', '=', 'v1'],
        fields: 'id,title',
        results: undefined,
      },
      { family: 4 },
    )
  })

  it('vndbRequest(multiple) returns all results and supports custom path/results', async () => {
    const { service, httpService } = createService()
    httpService.post.mockReturnValueOnce(
      of({
        data: {
          results: [{ id: 'r1' }, { id: 'r2' }],
        },
      }),
    )

    await expect(
      service.vndbRequest(
        'multiple',
        ['vn', '=', ['id', '=', 'v1']],
        ['id', 'images'],
        'release',
        100,
      ),
    ).resolves.toEqual([{ id: 'r1' }, { id: 'r2' }])
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.vndb.org/kana/release',
      {
        filters: ['vn', '=', ['id', '=', 'v1']],
        fields: 'id,images',
        results: 100,
      },
      { family: 4 },
    )
  })

  it('vndbRequest wraps request errors as business exceptions', async () => {
    const { service, httpService } = createService()
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    httpService.post.mockReturnValueOnce(throwError(() => new Error('vndb timeout')))

    await expect(service.vndbRequest('single', ['id', '=', 'v1'], ['id'])).rejects.toMatchObject({
      code: ShionBizCode.GAME_VNDB_REQUEST_FAILED,
    })
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
