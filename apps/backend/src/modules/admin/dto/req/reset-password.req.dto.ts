import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator'

export class AdminResetPasswordReqDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/)
  password: string
}
