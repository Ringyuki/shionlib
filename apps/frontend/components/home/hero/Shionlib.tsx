import { FadeImage } from '@/components/common/shared/FadeImage'
import { SiteLogo } from '@/components/common/top-bar/SiteLogo'
import { useTranslations } from 'next-intl'

export const Shionlib = () => {
  const t = useTranslations('Components.Home.Hero.Shionlib')
  return (
    <div className="h-60 md:h-72 rounded-md overflow-hidden relative select-none shadow-card border">
      <FadeImage
        className="object-cover w-full h-full mt-[-10px] ml-[10px] md:ml-[40px] scale-120"
        src="/assets/images/hero/shion-hero-left1.webp"
        alt="Shion Hero Left"
        aspectRatio="16 / 9"
        sizes="32vw"
        fill
        preload
        showSkeleton={false}
        imageClassName="event-none drag-none"
      />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 p-4 z-10 flex flex-col gap-2 items-end justify-end">
        <SiteLogo className="text-white text-3xl md:text-5xl drop-shadow-md" />
        <span className="text-white/90 text-sm md:text-base drop-shadow-md">
          {t('description')}
        </span>
      </div>
    </div>
  )
}
