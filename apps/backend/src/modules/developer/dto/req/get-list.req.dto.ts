import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { IsString, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class GetListReqDto extends PaginationReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'q' }) })
  @IsOptional()
  q?: string
}
