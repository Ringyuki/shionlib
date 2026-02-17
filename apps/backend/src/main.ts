import { NestFactory, Reflector } from '@nestjs/core'
import { ShionConfigService } from './common/config/services/config.service'
import { NestExpressApplication } from '@nestjs/platform-express'
import { I18nService } from 'nestjs-i18n'
import { AppModule } from './app.module'
import { requestId } from './common/middlewares/request-id.middleware'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor'
import { ValidationPipe, Logger } from '@nestjs/common'
import { ShionBizException } from './common/exceptions/shion-business.exception'
import { ShionBizCode } from './shared/enums/biz-code/shion-biz-code.enum'
import { flattenValidationErrors } from './common/validation/flatten-validation.util'
import { HttpStatus } from '@nestjs/common'
import { ShionWsAdapter } from './common/ws/ws.adapter'
import cookieParser from 'cookie-parser'
import * as express from 'express'
import { Redis } from 'ioredis'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.disable('x-powered-by')
  app.use(requestId())
  app.use(cookieParser())
  app.set('query parser', 'extended')
  app.set('trust proxy', true)
  const configService = app.get(ShionConfigService)

  const redis = app.get<Redis>(Redis)
  app.useWebSocketAdapter(new ShionWsAdapter(app, configService, redis))

  app.use(
    '/uploads/large',
    express.raw({
      type: 'application/octet-stream',
      limit: configService.get('file_upload.upload_large_file_transfer_limit'),
    }),
  )

  app.enableCors({
    origin: configService.get('cors.origin'),
    methods: configService.get('cors.methods'),
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['shionlib-auth-stale'],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      exceptionFactory: errors =>
        new ShionBizException(
          ShionBizCode.COMMON_VALIDATION_FAILED,
          'shion-biz.COMMON_VALIDATION_FAILED',
          { errors: flattenValidationErrors(errors) },
          HttpStatus.BAD_REQUEST,
        ),
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter(app.get(I18nService), app.get(Logger)))
  app.useGlobalInterceptors(
    new SuccessResponseInterceptor(app.get(Reflector), app.get(I18nService)),
  )

  const port = configService.get('port')
  await app.listen(port)
  console.log(`shionlib backend running on http://localhost:${port}`)
}
bootstrap()
