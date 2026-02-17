import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { I18nService, I18nContext } from 'nestjs-i18n'
import { map } from 'rxjs/operators'
import { ShionBizCode } from '../../shared/enums/biz-code/shion-biz-code.enum'
import { ResponseInterface } from '../../shared/interfaces/response/response.interface'
import { RequestWithUser } from '../../shared/interfaces/auth/request-with-user.interface'

export const RESPONSE_MESSAGE_KEY = 'response_message_key'
@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly i18n: I18nService,
  ) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>()
    const res = ctx
      .switchToHttp()
      .getResponse<{ setHeader: (key: string, value: string) => void }>()
    const i18nCtx = I18nContext.current(ctx)
    const messageKey = this.reflector.get<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      ctx.getHandler(),
    )
    const authMeta =
      req.auth?.optionalTokenStale === true
        ? {
            auth: {
              optionalTokenStale: true,
              optionalTokenReason: req.auth.optionalTokenReason || 'invalid_token',
            },
          }
        : undefined

    if (authMeta?.auth?.optionalTokenStale) {
      res.setHeader('shionlib-auth-stale', '1')
    }

    return next.handle().pipe(
      map(
        (data): ResponseInterface<typeof data> => ({
          code: ShionBizCode.COMMON_SUCCESS,
          message: messageKey
            ? (this.i18n.t(messageKey, { lang: i18nCtx?.lang, args: data }) as string)
            : (this.i18n.t('common.success', { lang: i18nCtx?.lang }) as string),
          data,
          requestId: req.id ?? '',
          timestamp: new Date().toISOString(),
          ...(authMeta ? { meta: authMeta } : {}),
        }),
      ),
    )
  }
}
