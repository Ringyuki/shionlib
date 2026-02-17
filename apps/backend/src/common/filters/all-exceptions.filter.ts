import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { I18nService, I18nContext, I18nValidationException } from 'nestjs-i18n'
import { I18nPath } from '../../generated/i18n.generated'
import { ShionBizCode } from '../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionBizCodeHttpStatus } from '../../shared/enums/biz-code/shion-biz-code-http-status.enum'
import { ShionBizException } from '../../common/exceptions/shion-business.exception'
import { ResponseInterface } from '../../shared/interfaces/response/response.interface'
import { formattingValidationMessage } from '../validation/formatting-validation-message.utl'
import { FieldError } from '../../shared/interfaces/response/response.interface'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly i18n: I18nService,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()
    const i18nCtx = I18nContext.current(host)
    const lang = i18nCtx?.lang ?? 'en'

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code: number = HttpStatus.INTERNAL_SERVER_ERROR
    let messageKey: I18nPath = 'common.error'
    let args: Record<string, any> | undefined

    if (exception instanceof I18nValidationException) {
      code = ShionBizCode.COMMON_VALIDATION_FAILED
      status = ShionBizCodeHttpStatus[code] ?? HttpStatus.BAD_REQUEST
      messageKey = 'shion-biz.COMMON_VALIDATION_FAILED' as I18nPath

      const rawErrors =
        typeof (exception as any).getErrors === 'function'
          ? (exception as any).getErrors()
          : Array.isArray((exception as any).errors)
            ? (exception as any).errors
            : []

      args = {
        errors: rawErrors.map((e: any): FieldError => {
          const msgs = Object.values(e?.constraints ?? {}).map(m =>
            formattingValidationMessage(m, this.i18n, lang),
          )
          return { field: e?.property ?? '', messages: msgs }
        }),
      }
    } else if (exception instanceof ShionBizException) {
      code = exception.code
      status = ShionBizCodeHttpStatus[code] ?? exception.getStatus() ?? HttpStatus.BAD_REQUEST
      messageKey = exception.messageKey ?? (`shion-biz.${ShionBizCode[exception.code]}` as I18nPath)
      const baseArgs = exception.args ?? {}
      const rawErrors = baseArgs?.errors ?? []
      args = {
        ...baseArgs,
        errors: rawErrors.map(
          (e: any): FieldError => ({
            field: e.field ?? '',
            messages: (e.messages ?? []).map((m: string) =>
              formattingValidationMessage(m, this.i18n, lang),
            ),
          }),
        ),
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      code = status
      messageKey = `http.${status}` as I18nPath
    }

    const message = this.i18n.t(messageKey, { lang, args }) as string
    let data =
      code === ShionBizCode.COMMON_VALIDATION_FAILED ? { errors: args?.errors ?? [] } : null
    if (exception instanceof ShionBizException && exception.customErrors) {
      data = { errors: exception.customErrors ?? [] }
    }
    if (data && data.errors.length === 0) {
      data = null
    }
    const body: ResponseInterface<{ errors: FieldError[] } | null> = {
      code,
      message,
      data,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    }

    const meta = {
      requestId: req?.id,
      method: req?.method,
      url: req?.originalUrl || req?.url,
      ip: (req.headers['x-real-ip'] as string) || (req.headers['cf-connecting-ip'] as string),
      userAgent: req.headers['user-agent'] as string,
      userId: req?.user?.sub,
      status,
      code,
      messageKey,
    }
    const msg = `[${meta.requestId}] ${meta.method} ${meta.url} code=${meta.code} status=${meta.status} user=${meta.userId ?? '-'} ip=${meta.ip ?? '-'}`

    if (status >= 500) {
      this.logger.error(msg, exception instanceof Error ? exception.stack : undefined)
    } else if (status >= 400 && status !== 401 && status < 500) {
      this.logger.warn(msg)
    }

    res.status(status).json(body)
  }
}
