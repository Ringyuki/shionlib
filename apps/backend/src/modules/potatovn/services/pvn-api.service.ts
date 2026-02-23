import { HttpStatus, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

@Injectable()
export class PvnApiService {
  readonly baseUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {
    this.baseUrl = this.configService.get('potatovn.baseUrl')
  }

  async get<T>(userId: number, path: string, params?: Record<string, unknown>): Promise<T> {
    const token = await this.fetchToken(userId)
    const { data } = await firstValueFrom(
      this.httpService.get<T>(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    )
    return data
  }

  async patch<T>(userId: number, path: string, body?: unknown): Promise<T> {
    const token = await this.fetchToken(userId)
    const { data } = await firstValueFrom(
      this.httpService.patch<T>(`${this.baseUrl}${path}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    return data
  }

  async delete(userId: number, path: string): Promise<void> {
    const token = await this.fetchToken(userId)
    await firstValueFrom(
      this.httpService.delete(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
  }

  async put(
    userId: number,
    path: string,
    params?: Record<string, unknown>,
    body?: unknown,
  ): Promise<void> {
    const token = await this.fetchToken(userId)
    await firstValueFrom(
      this.httpService.put(`${this.baseUrl}${path}`, body ?? null, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    )
  }

  async postPublic<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await firstValueFrom(this.httpService.post<T>(`${this.baseUrl}${path}`, body))
    return data
  }

  async putRaw(url: string, buffer: Buffer, contentType: string): Promise<void> {
    await firstValueFrom(
      this.httpService.put(url, buffer, {
        headers: { 'Content-Type': contentType },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }),
    )
  }

  private async fetchToken(userId: number): Promise<string> {
    const binding = await this.prisma.userPvnBinding.findUnique({
      where: { user_id: userId },
      select: { pvn_token: true },
    })

    if (!binding) {
      throw new ShionBizException(
        ShionBizCode.PVN_BINDING_NOT_FOUND,
        'shion-biz.PVN_BINDING_NOT_FOUND',
        undefined,
        HttpStatus.NOT_FOUND,
      )
    }

    return binding.pvn_token
  }
}
