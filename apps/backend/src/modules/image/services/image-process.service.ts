import { Injectable } from '@nestjs/common'
import sharp from 'sharp'
import { ImageProcessReqDto, TargetFormat } from '../dto/req/image-process.req.dto'
import {
  ImageProcessResDto,
  TargetFormat as TargetFormatRes,
} from '../dto/res/image-process.res.dto'

@Injectable()
export class ImageProcessService {
  constructor() {}

  async process(input: Buffer, opt: ImageProcessReqDto): Promise<ImageProcessResDto> {
    let image = sharp(input, { failOn: 'none', unlimited: false })
      .rotate()
      .withMetadata({ orientation: 1 })

    const meta = await image.metadata()
    const hasAlpha = meta.hasAlpha

    if (opt.maxWidth || opt.maxWidth) {
      image = image.resize({
        width: opt.maxWidth,
        height: opt.maxHeight,
        fit: 'inside',
        withoutEnlargement: opt.withoutEnlargement,
      })
    }
    if (!opt.preserveMetadata) {
      image = image.withMetadata({})
    }

    const target = this.pickTargetFormat(hasAlpha, opt.format)
    if (target === 'jpeg' && hasAlpha) {
      image = image.flatten({ background: '#ffffff' })
    }

    switch (target) {
      case 'jpeg':
        image = image.jpeg({ quality: opt.quality, progressive: opt.progressive, mozjpeg: true })
        break
      case 'png':
        image = image.png({
          palette: true,
          quality: opt.preferLossless ? 100 : undefined,
          compressionLevel: opt.compressionLevel,
        })
        break
      case 'webp':
        image = image.webp({
          quality: opt.quality,
          lossless: opt.preferLossless && hasAlpha,
          effort: opt.preferLossless ? 6 : undefined,
        })
        break
      case 'avif':
        image = image.avif({
          quality: opt.quality,
          lossless: opt.preferLossless && hasAlpha,
          effort: opt.preferLossless ? 7 : undefined,
        })
        break
    }

    const { data, info } = await image.toBuffer({ resolveWithObject: true })
    const { ext, mime } = this.extAndMime(target)
    return {
      data,
      format: target,
      info,
      filenameSuffix: ext,
      mime,
    }
  }

  private pickTargetFormat(hasAlpha: boolean, format: TargetFormat): TargetFormatRes {
    if (format === 'auto') {
      return hasAlpha ? 'webp' : 'webp'
    }
    return format
  }

  private extAndMime(format: TargetFormatRes) {
    switch (format) {
      case 'jpeg':
        return { ext: '.jpg', mime: 'image/jpeg' }
      case 'png':
        return { ext: '.png', mime: 'image/png' }
      case 'webp':
        return { ext: '.webp', mime: 'image/webp' }
      case 'avif':
        return { ext: '.avif', mime: 'image/avif' }
    }
  }
}
