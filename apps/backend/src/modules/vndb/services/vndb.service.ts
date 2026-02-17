import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@Injectable()
export class VNDBService {
  constructor(private readonly httpService: HttpService) {}

  async vndbRequest<T>(
    resultType: 'single',
    filters: Array<string | Array<string>>,
    fields: string[],
    path?: string,
    results?: number,
  ): Promise<T>
  async vndbRequest<T>(
    resultType: 'multiple',
    filters: Array<string | Array<string>>,
    fields: string[],
    path: string,
    results?: number,
  ): Promise<T[]>
  async vndbRequest<T>(
    resultType: 'single' | 'multiple',
    filters: Array<string | Array<string>>,
    fields: string[],
    path: string = 'vn',
    results?: number,
  ): Promise<T | T[]> {
    const requestData = {
      filters: filters,
      fields: fields.join(','),
      results: results,
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post(`https://api.vndb.org/kana/${path}`, requestData, {
          family: 4,
        }),
      )

      if (resultType === 'single') {
        return response.data.results[0] as T
      } else {
        return response.data.results as T[]
      }
    } catch (error) {
      console.error(error)
      throw new ShionBizException(
        ShionBizCode.GAME_VNDB_REQUEST_FAILED,
        'shion-biz.GAME_VNDB_REQUEST_FAILED',
        { message: error.message },
      )
    }
  }
}
