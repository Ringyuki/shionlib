import { IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { TREND_WINDOWS } from '../../constants/analytics'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

enum TrendWindow {
  ONE_HOUR = '1h',
  SIX_HOURS = '6h',
  ONE_DAY = '1d',
}

export class GetTrendingReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'limit' }) },
  )
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: ivm('validation.common.MIN', { property: 'limit', min: 1 }) })
  @Max(50, { message: ivm('validation.common.MAX', { property: 'limit', max: 50 }) })
  limit?: number = 10

  @IsOptional()
  @IsIn(TREND_WINDOWS, {
    message: ivmEnum('validation.common.IS_ENUM', TrendWindow, { property: 'window' }),
  })
  window?: TrendWindow
}
