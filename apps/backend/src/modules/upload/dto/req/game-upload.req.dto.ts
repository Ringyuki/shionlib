import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class GameUploadReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_name' }) })
  file_name: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'total_size' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'total_size' }) })
  total_size: number

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'chunk_size' }) },
  )
  @IsOptional()
  chunk_size?: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_sha256' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_sha256' }) })
  file_sha256: string
}
