import { shionlibRequest } from '@/utils/request'
import { VNDBScore } from '@/interfaces/game/score/vndb.interface'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/shionui/Skeleton'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import useSWR from 'swr'

interface VNDBScoreCardProps {
  variant?: 'default' | 'overlay'
}

const fetcher = (url: string) =>
  shionlibRequest()
    .get<VNDBScore>(url)
    .then(res => res.data)

export const VNDBScoreCard = ({ variant = 'default' }: VNDBScoreCardProps) => {
  const t = useTranslations('Components.Game.Score.VNDB')
  const { id } = useParams()

  const { data: score, isLoading: loading } = useSWR<VNDBScore | null>(
    id ? `/game/score/vndb/${id}` : null,
    fetcher,
  )

  if (!loading && !score) return null

  const isOverlay = variant === 'overlay'

  if (isOverlay) {
    return (
      <Link href={`https://vndb.org/${score?.id}`} target="_blank">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-colors select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/game/The_Visual_Novel_Database_logo.svg"
            alt="VNDB"
            className="h-3 w-auto brightness-0 invert"
          />
          {loading ? (
            <Skeleton className="h-6 w-10" />
          ) : (
            <span className="text-base font-bold text-white">
              {score?.rating?.toFixed(2) ?? '-'}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link href={`https://vndb.org/${score?.id}`} target="_blank">
      <div className="relative w-42 md:w-48 h-20 md:h-24 rounded-xl overflow-hidden shadow-lg group select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/game/vndb-angel.webp"
          alt="VNDB"
          className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-indigo-900/70 to-blue-800/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="relative z-10 h-full p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/game/The_Visual_Novel_Database_logo.svg"
              alt="VNDB"
              className="h-6 md:h-8 w-auto brightness-0 invert"
            />
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold text-white drop-shadow-md">
                {score?.rating?.toFixed(2) ?? '-'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end text-[11px] text-white/90">
            {loading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <div className="flex items-center gap-1">
                <span className="font-medium">{score?.votecount?.toLocaleString() ?? '-'}</span>
                <span className="opacity-70">{t('votes')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
