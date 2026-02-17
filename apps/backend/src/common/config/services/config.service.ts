import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConfigPath, ConfigPathValue } from '../types/config.type'

@Injectable()
export class ShionConfigService {
  constructor(private readonly configService: ConfigService) {}

  get<T extends ConfigPath>(path: T): ConfigPathValue<T> {
    return this.configService.get<ConfigPathValue<T>>(path) as ConfigPathValue<T>
  }
}
