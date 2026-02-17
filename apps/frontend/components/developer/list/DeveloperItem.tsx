import { Developer } from '@/interfaces/developer/developer.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { Link } from '@/i18n/navigation'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Badge } from '@/components/shionui/Badge'
import { getTranslations } from 'next-intl/server'

interface DeveloperItemProps {
  developer: Developer
}

export const DeveloperItem = async ({ developer }: DeveloperItemProps) => {
  const t = await getTranslations('Components.Developer.List.DeveloperItem')
  return (
    <Card className="py-0 hover:bg-card-hover transition-colors duration-200">
      <CardContent className="p-2">
        <Link href={`/developer/${developer.id}`} className="flex items-center gap-2">
          <div className="h-16 w-16 overflow-hidden rounded-md object-contain bg-muted">
            {developer.logo && (
              <FadeImage
                src={developer.logo}
                alt={developer.name}
                height={50}
                width={50}
                fill={false}
                imageClassName="object-contain h-full w-full"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-normal">{developer.name}</h3>
            <Badge variant="secondary">{t('works_count', { count: developer.works_count })}</Badge>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
