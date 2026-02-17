import { IsNumber, IsString, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CreateGameDownloadSourceFileReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_name' }) })
  file_name: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'file_size' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_size' }) })
  file_size: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_hash' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_hash' }) })
  file_hash: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_content_type' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_content_type' }) })
  file_content_type: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 's3_file_key' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 's3_file_key' }) })
  s3_file_key: string
}
