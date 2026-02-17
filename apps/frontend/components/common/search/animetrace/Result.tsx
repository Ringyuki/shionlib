import { AnimeTraceResponse } from '@/interfaces/search/anime-trace.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { getTargetBox } from './helper/get-target-box'
import { Badge } from '@/components/shionui/Badge'
import { Card, CardContent } from '@/components/shionui/Card'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation.client'
import { SearchIcon } from 'lucide-react'

interface AnimeTraceResultProps {
  result: AnimeTraceResponse
  image: ImageBitmap
}

export const AnimeTraceResult = ({ result, image }: AnimeTraceResultProps) => {
  const t = useTranslations('Components.Common.Search.AnimeTrace.Result')
  return (
    <div className="flex flex-col gap-4">
      {result.data.map((item, index) => {
        const candidates = item.character || []
        return (
          <Card key={item.box_id} className="overflow-hidden py-0 px-0">
            <CardContent className="py-4 px-4 space-y-4 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-12 h-12 shrink-0">
                  <FadeImage
                    src={getTargetBox(item.box, image)}
                    alt={item.character[0].character}
                    fill
                    className="w-full h-full rounded-md object-contain"
                  />
                </div>
                <div className="flex flex-col flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    <span className="text-sm font-medium">{candidates[0].character}</span>
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </span>
                  <Badge variant="neutral" size="sm">
                    {t('candidates', { count: candidates.length })}
                  </Badge>
                  {item.not_confident && (
                    <Badge variant="warning" size="sm">
                      {t('lowConfidence')}
                    </Badge>
                  )}
                </div>
              </div>
              {candidates.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {candidates.map((candidate, candidateIndex) => (
                    <Link
                      key={`${item.box_id}-${candidateIndex}`}
                      href={`/search/game?q=${candidate.work || candidate.character}`}
                      target="_blank"
                      className="text-sm space-y-1 hover:text-primary transition-colors"
                    >
                      <div className="font-medium line-clamp-1 flex items-center gap-1">
                        <SearchIcon className="size-4 shrink-0" />
                        {candidate.character || t('unknownCharacter')}
                      </div>
                      <div className="text-muted-foreground line-clamp-1">
                        {candidate.work || t('unknownWork')}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
