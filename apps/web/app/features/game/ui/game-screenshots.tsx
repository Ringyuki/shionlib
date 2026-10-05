import { Image, ImageGroup, Masonry, Section, Spoiler } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { imageSize, masked, type GameImage } from '../game'

export function GameScreenshots({
  images,
  contentLimit,
}: {
  images: GameImage[]
  contentLimit: number
}) {
  const t = useTranslations('game')
  const positions = images.map((image, index) => ({ image, index }))
  return (
    <Section title={t('info.screenshots')}>
      <ImageGroup>
        <Masonry items={positions} getKey={entry => entry.index} minColumnWidth={240} gap="sm">
          {({ item }) => {
            const size = imageSize(item.image)
            const screenshot = (
              <Image
                src={item.image.url}
                alt={t('info.screenshot')}
                ratio={size === undefined ? 16 / 9 : size.width / size.height}
                preview
                previewSize={size}
                className="rounded-lg"
              />
            )
            return masked(item.image, contentLimit) ? (
              <Spoiler aria-label={t('cover.explicit')} className="block rounded-lg">
                {screenshot}
              </Spoiler>
            ) : (
              screenshot
            )
          }}
        </Masonry>
      </ImageGroup>
    </Section>
  )
}
