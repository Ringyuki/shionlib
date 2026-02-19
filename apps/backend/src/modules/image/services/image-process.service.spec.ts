jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(),
}))

import sharp from 'sharp'
import { ImageProcessService } from './image-process.service'

describe('ImageProcessService', () => {
  const sharpMock = sharp as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockSharpPipeline(hasAlpha: boolean) {
    const image: any = {}
    image.rotate = jest.fn(() => image)
    image.withMetadata = jest.fn(() => image)
    image.metadata = jest.fn().mockResolvedValue({ hasAlpha })
    image.resize = jest.fn(() => image)
    image.flatten = jest.fn(() => image)
    image.jpeg = jest.fn(() => image)
    image.png = jest.fn(() => image)
    image.webp = jest.fn(() => image)
    image.avif = jest.fn(() => image)
    image.toBuffer = jest.fn().mockResolvedValue({
      data: Buffer.from('img-data'),
      info: { format: 'mock', width: 1, height: 1 } as any,
    })

    sharpMock.mockReturnValue(image)
    return image
  }

  it('process handles jpeg target with alpha flatten and resize', async () => {
    const service = new ImageProcessService()
    const image = mockSharpPipeline(true)

    const result = await service.process(Buffer.from('input'), {
      format: 'jpeg',
      quality: 80,
      maxWidth: 100,
      maxHeight: 200,
      progressive: true,
      preserveMetadata: false,
      withoutEnlargement: true,
    } as any)

    expect(sharpMock).toHaveBeenCalledWith(Buffer.from('input'), {
      failOn: 'none',
      unlimited: false,
    })
    expect(image.rotate).toHaveBeenCalledTimes(1)
    expect(image.withMetadata).toHaveBeenNthCalledWith(1, { orientation: 1 })
    expect(image.withMetadata).toHaveBeenNthCalledWith(2, {})
    expect(image.resize).toHaveBeenCalledWith({
      width: 100,
      height: 200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    expect(image.flatten).toHaveBeenCalledWith({ background: '#ffffff' })
    expect(image.jpeg).toHaveBeenCalledWith({ quality: 80, progressive: true, mozjpeg: true })
    expect(result).toMatchObject({
      format: 'jpeg',
      filenameSuffix: '.jpg',
      mime: 'image/jpeg',
    })
  })

  it('process handles png target with optional lossless quality', async () => {
    const service = new ImageProcessService()
    const image = mockSharpPipeline(false)

    const result = await service.process(Buffer.from('input'), {
      format: 'png',
      compressionLevel: 7,
      preferLossless: true,
      preserveMetadata: true,
    } as any)

    expect(image.resize).not.toHaveBeenCalled()
    expect(image.png).toHaveBeenCalledWith({
      palette: true,
      quality: 100,
      compressionLevel: 7,
    })
    expect(result).toMatchObject({
      format: 'png',
      filenameSuffix: '.png',
      mime: 'image/png',
    })
  })

  it('process handles auto target as webp and sets lossless only when alpha exists', async () => {
    const service = new ImageProcessService()
    const image = mockSharpPipeline(true)

    const result = await service.process(Buffer.from('input'), {
      format: 'auto',
      quality: 60,
      preferLossless: true,
      preserveMetadata: true,
    } as any)

    expect(image.webp).toHaveBeenCalledWith({
      quality: 60,
      lossless: true,
      effort: 6,
    })
    expect(result).toMatchObject({
      format: 'webp',
      filenameSuffix: '.webp',
      mime: 'image/webp',
    })
  })

  it('process handles avif target and private helpers map formats correctly', async () => {
    const service = new ImageProcessService()
    const image = mockSharpPipeline(false)

    const result = await service.process(Buffer.from('input'), {
      format: 'avif',
      quality: 55,
      preferLossless: true,
      preserveMetadata: true,
    } as any)

    expect(image.avif).toHaveBeenCalledWith({
      quality: 55,
      lossless: false,
      effort: 7,
    })
    expect(result).toMatchObject({
      format: 'avif',
      filenameSuffix: '.avif',
      mime: 'image/avif',
    })

    expect((service as any).pickTargetFormat(true, 'auto')).toBe('webp')
    expect((service as any).pickTargetFormat(false, 'jpeg')).toBe('jpeg')
    expect((service as any).extAndMime('jpeg')).toEqual({ ext: '.jpg', mime: 'image/jpeg' })
    expect((service as any).extAndMime('png')).toEqual({ ext: '.png', mime: 'image/png' })
    expect((service as any).extAndMime('webp')).toEqual({ ext: '.webp', mime: 'image/webp' })
    expect((service as any).extAndMime('avif')).toEqual({ ext: '.avif', mime: 'image/avif' })
  })
})
