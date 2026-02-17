import { IsBoolean, IsNotEmpty, IsEnum, IsOptional } from 'class-validator'
import { UndoMode } from '../../enums/undo.enum'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

export class UndoReqDto {
  @IsEnum(UndoMode, {
    message: ivmEnum('validation.common.IS_ENUM', UndoMode, { property: 'mode' }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'mode' }) })
  mode: UndoMode = UndoMode.STRICT

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'force' }) })
  @IsOptional()
  force: boolean = false

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'dryRun' }) })
  @IsOptional()
  dryRun: boolean = false
}
