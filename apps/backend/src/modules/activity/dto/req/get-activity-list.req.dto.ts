import { IsEnum, IsOptional } from 'class-validator'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { ivmEnum } from '../../../../common/validation/i18n'
import { ActivityListCategory } from '../../constants/activity-list-category.constant'

export class GetActivityListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsEnum(ActivityListCategory, {
    message: ivmEnum('validation.common.IS_ENUM', ActivityListCategory, { property: 'category' }),
  })
  category?: ActivityListCategory
}
