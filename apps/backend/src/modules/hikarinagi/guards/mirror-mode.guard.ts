import { CanActivate, Injectable } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

/**
 * Entry data (games, characters, developers) is read through from hikarinagi, so the local write
 * paths that would fork it are closed. Downloads, comments, favorites and every other
 * shionlib-owned surface stay open.
 */
@Injectable()
export class MirrorModeGuard implements CanActivate {
  constructor(private readonly configService: ShionConfigService) {}

  canActivate(): boolean {
    if (this.configService.get('hikarinagi.base_url')) {
      throw new ShionBizException(ShionBizCode.GAME_ENTRY_MIRRORED)
    }
    return true
  }
}
