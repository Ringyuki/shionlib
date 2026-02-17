import { OutputInfo } from 'sharp'

export type TargetFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export class ImageProcessResDto {
  data: Buffer
  format: TargetFormat
  info: OutputInfo
  filenameSuffix: string
  mime: string
}
