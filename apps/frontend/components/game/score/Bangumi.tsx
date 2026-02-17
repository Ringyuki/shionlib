import { shionlibRequest } from '@/utils/request'
import { BangumiScore } from '@/interfaces/game/score/bangumi.interface'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/shionui/Skeleton'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import useSWR from 'swr'

interface BangumiScoreCardProps {
  variant?: 'default' | 'overlay'
}

const fetcher = (url: string) =>
  shionlibRequest()
    .get<BangumiScore>(url)
    .then(res => res.data)

export const BangumiScoreCard = ({ variant = 'default' }: BangumiScoreCardProps) => {
  const t = useTranslations('Components.Game.Score.Bangumi')
  const { id } = useParams()

  const { data: score, isLoading: loading } = useSWR<BangumiScore | null>(
    id ? `/game/score/bangumi/${id}` : null,
    fetcher,
  )

  if (!loading && !score) return null

  const isOverlay = variant === 'overlay'

  if (isOverlay) {
    return (
      <Link href={`https://bgm.tv/subject/${score?.id}`} target="_blank">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-colors select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/game/Bangumi_Logo.png"
            alt="Bangumi"
            className="h-3.5 w-auto brightness-0 invert"
          />
          {loading ? (
            <Skeleton className="h-6 w-8" />
          ) : (
            <span className="text-base font-bold text-white">
              {score?.rating?.score?.toFixed(1) ?? '-'}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link href={`https://bangumi.tv/subject/${score?.id}`} target="_blank">
      <div className="relative w-42 md:w-48 h-20 md:h-24 rounded-xl overflow-hidden shadow-lg group select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/game/bangumi-tv.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 via-pink-400/70 to-rose-300/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        <div className="relative z-10 h-full p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/game/Bangumi_Logo.png"
              alt="Bangumi"
              className="h-4 md:h-5 w-auto brightness-0 invert"
            />
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold text-white drop-shadow-md">
                {score?.rating?.score?.toFixed(1) ?? '-'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/90">
            {loading ? (
              <>
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <span className="opacity-70">{t('rank')}</span>
                  <span className="font-semibold">#{score?.rating?.rank || '-'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {score?.rating?.total?.toLocaleString() ?? '-'}
                  </span>
                  <span className="opacity-70">{t('votes')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
