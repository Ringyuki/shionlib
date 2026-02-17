import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { FadeImage } from '@/components/common/shared/FadeImage'

export const Moyu = () => {
  const t = useTranslations('Components.Game.Patch.PatchContent')
  return (
    <div className="flex justify-center items-center gap-2 pb-4 lg:pb-0">
      <span className="text-xs text-muted-foreground">{t('datafrom')}</span>
      <Link href="https://www.moyu.moe" target="_blank" className="flex items-center gap-2">
        <span className="size-4 shrink-0">
          <FadeImage
            src="https://www.moyu.moe/favicon.ico"
            alt="moyu"
            className="size-full rounded-full"
          />
        </span>
        <span className="flex items-center gap-1">
          <span className="text-xs font-medium">鲲 Galgame</span>
          <span className="py-0.5 px-1 rounded-full bg-[hsl(212.02_100%_46.67%_/_0.2)] text-[hsl(212.02_100%_46.67%)] text-[0.625rem]">
            补丁
          </span>
        </span>
      </Link>
    </div>
  )
}
