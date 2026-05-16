import 'react-medium-image-zoom/dist/styles.css'
import { useTranslations } from 'next-intl'
import { GameImage } from '@/interfaces/game/game.interface'
import { Spoiler } from '@/components/shionui/Spoiler'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { ImageLightbox } from '@/components/shionui/ImageLightbox'
import { ImageLightboxGallery } from '@/components/shionui/ImageLightboxGallery'

interface GameImagesProps {
  images: GameImage[]
  content_limit?: ContentLimit
}

const getGameImageKey = (image: GameImage, index: number) =>
  `image-${image.id ?? image.url}-${index}`

const _GameImage = ({ image }: { image: GameImage }) => {
  return (
    <ImageLightbox
      src={image.url}
      alt={image.url}
      aspectRatio="16 / 9"
      className="rounded-md overflow-hidden"
      hideTriggerWhileOpen={false}
    />
  )
}

export const GameImages = ({ images, content_limit }: GameImagesProps) => {
  const t = useTranslations('Components.Game.Description.GameDetail')

  return (
    images.length > 0 && (
      <>
        {(!!content_limit ||
          images.filter(images => images.sexual === 0 && images.violence === 0).length > 0) && (
          <h2 className="flex items-center gap-4 text-lg font-bold">
            <div className="w-1 h-6 bg-primary rounded" />
            <span>{t('images')}</span>
          </h2>
        )}
        <ImageLightboxGallery>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {images.map((image, index) => {
              const key = getGameImageKey(image, index)
              if (image.sexual > 0) {
                if (content_limit === ContentLimit.SHOW_WITH_SPOILER)
                  return (
                    <Spoiler key={key} blur={32} showHint={true}>
                      <_GameImage image={image} />
                    </Spoiler>
                  )
                if (content_limit === ContentLimit.JUST_SHOW)
                  return <_GameImage key={key} image={image} />
                return null
              }
              return <_GameImage key={key} image={image} />
            })}
          </div>
        </ImageLightboxGallery>
      </>
    )
  )
}
