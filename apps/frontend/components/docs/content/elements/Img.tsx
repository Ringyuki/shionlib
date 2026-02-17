import { ImageLightbox } from '@/components/shionui/ImageLightbox'

interface ImgProps {
  src: string
  alt: string
  className?: string
}

export const Img = ({ src, alt, className }: ImgProps) => {
  return (
    <ImageLightbox
      wrapElement="span"
      src={src}
      alt={alt}
      aspectRatio="16 / 9"
      className={className}
      maxWidth={1920}
      autoAspectRatio={true}
      sizes="32vw"
    />
  )
}
