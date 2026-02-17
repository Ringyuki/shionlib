import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { IsBoolean, IsOptional, IsEnum } from 'class-validator'
import { Transform } from 'class-transformer'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import { MessageType } from './send-message.req.dto'

export class GetMessagesReqDto extends PaginationReqDto {
  @IsOptional()
  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'unread' }) })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  unread?: boolean

  @IsOptional()
  @IsEnum(MessageType, {
    message: ivmEnum('validation.common.IS_ENUM', MessageType, { property: 'type' }),
  })
  type?: MessageType
}
