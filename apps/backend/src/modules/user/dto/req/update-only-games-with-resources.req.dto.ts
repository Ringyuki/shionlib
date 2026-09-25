import { IsBoolean } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateOnlyGamesWithResourcesReqDto {
  @IsBoolean({
    message: ivm('validation.common.IS_BOOLEAN', { property: 'only_games_with_resources' }),
  })
  only_games_with_resources: boolean
}
