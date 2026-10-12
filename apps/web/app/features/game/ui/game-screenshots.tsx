import { ImageGroup, Masonry, Section } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { imageSize, type GameImage } from '../game'
import { GamePicture } from './game-picture'

export function GameScreenshots({ images }: { images: GameImage[] }) {
  const t = useTranslations('game.info')
  const positions = images.map((image, index) => ({ image, index }))
  return (
    <Section title={t('screenshots')}>
      <ImageGroup>
        <Masonry items={positions} getKey={entry => entry.index} minColumnWidth={240} gap="sm">
          {({ item }) => {
            const size = imageSize(item.image)
            return (
              <GamePicture
                picture={item.image}
                alt={t('screenshot')}
                ratio={size === undefined ? 16 / 9 : size.width / size.height}
                preview
                className="rounded-lg"
              />
            )
          }}
        </Masonry>
      </ImageGroup>
    </Section>
  )
}
