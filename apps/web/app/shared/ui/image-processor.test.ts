import { describe, expect, it } from 'vitest'
import { faceImage } from './image-processor'

const config = {
  imageBucketUrl: 'https://images.yurari.moe',
  imageProcessorUrl: 'https://imagesp.yurari.moe',
}

describe('faceImage', () => {
  it('asks the processor for an object of its bucket by the key', () => {
    expect(faceImage(config, 'https://images.yurari.moe/images/a.webp', 32)).toBe(
      'https://imagesp.yurari.moe/images/a.webp?w=32&h=32&dpr=3&fit=cover&gravity=face&f=auto',
    )
  })

  it('takes the size of the box it fills', () => {
    expect(faceImage(config, 'https://images.yurari.moe/galgame/1/a.webp', 40)).toBe(
      'https://imagesp.yurari.moe/galgame/1/a.webp?w=40&h=40&dpr=3&fit=cover&gravity=face&f=auto',
    )
  })

  it.each([
    ['a stored key', 'user/5/avatar/a.webp'],
    ['another host', 'https://lain.bgm.tv/pic/crt/l/a.jpg'],
    ['a host that only starts like the bucket', 'https://images.yurari.moe.example/a.webp'],
    ['an address with a query', 'https://images.yurari.moe/images/a.webp?v=2'],
    ['a site asset', '/brand/logo.png'],
    ['an inline picture', 'data:image/png;base64,AAAA'],
    ['a picture of this browser', 'blob:abc'],
    ['nothing', ''],
  ])('leaves %s to its own address', (_, src) => {
    expect(faceImage(config, src, 32)).toBeUndefined()
  })

  it('processes nothing without a processor or a bucket', () => {
    const src = 'https://images.yurari.moe/images/a.webp'
    expect(faceImage({ ...config, imageProcessorUrl: '' }, src, 32)).toBeUndefined()
    expect(faceImage({ ...config, imageBucketUrl: '' }, src, 32)).toBeUndefined()
  })
})
