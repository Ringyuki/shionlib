import { DocsMetadata } from '@/interfaces/contents/docs.interface'
import { FadeImage } from '../common/shared/FadeImage'
import { Link } from '@/i18n/navigation'
import { CalendarDays, Type } from 'lucide-react'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '../shionui/Card'

interface DocCardProps {
  doc: DocsMetadata
}

export const DocCard = ({ doc }: DocCardProps) => {
  const locale = useLocale()
  return (
    <Link
      href={`/docs/${doc.slug}`}
      className="flex flex-col gap-2 hover:opacity-80 transition-opacity duration-200"
    >
      <Card className="py-0">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="aspect-video overflow-hidden rounded-lg">
            <FadeImage
              src={doc.banner}
              alt={doc.title}
              aspectRatio="16 / 9"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{doc.title}</h3>
            <div className="flex justify-between items-center text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                {timeFromNow(doc.date, locale)}
              </div>
              <div className="flex items-center gap-2">
                <Type className="size-4" />
                {doc.text_count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
