import type { PublicConfig } from '~/shared/config/public-config'

type Processing = Pick<PublicConfig, 'imageBucketUrl' | 'imageProcessorUrl'>

const parameterized = /[?#]/
const density = 3

function keyOf({ imageBucketUrl, imageProcessorUrl }: Processing, src: string): string | undefined {
  const processable =
    imageProcessorUrl !== '' &&
    imageBucketUrl !== '' &&
    src.startsWith(`${imageBucketUrl}/`) &&
    !parameterized.test(src)
  return processable ? src.slice(imageBucketUrl.length + 1) : undefined
}

export function faceImage(config: Processing, src: string, size: number): string | undefined {
  const key = keyOf(config, src)
  if (key === undefined) {
    return undefined
  }
  const params = `w=${size}&h=${size}&dpr=${density}&fit=cover&gravity=face&f=auto`
  return `${config.imageProcessorUrl}/${key}?${params}`
}
