import { IsEnum, IsInt, IsOptional, Max, Min, IsBoolean } from 'class-validator'

export enum TargetFormatEnum {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  AUTO = 'auto',
}
export type TargetFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'auto'

export class ImageProcessReqDto {
  @IsEnum(TargetFormatEnum)
  format: TargetFormatEnum = TargetFormatEnum.AUTO

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxWidth?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxHeight?: number

  @IsOptional()
  @IsBoolean()
  progressive?: boolean

  @IsOptional()
  @IsBoolean()
  preserveMetadata?: boolean

  @IsOptional()
  @IsBoolean()
  withoutEnlargement?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  compressionLevel?: number = 9

  @IsOptional()
  @IsBoolean()
  preferLossless?: boolean
}
