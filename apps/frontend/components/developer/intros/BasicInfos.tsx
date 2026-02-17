import { Developer } from '@/interfaces/developer/developer.interface'
import { getTranslations } from 'next-intl/server'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Building2, Link as LinkIcon } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/shionui/Badge'

interface BasicInfosProps {
  developer: Developer
  works_count: number
}

export const BasicInfos = async ({ developer, works_count }: BasicInfosProps) => {
  const t = await getTranslations('Components.Developer.Intros.BasicInfos')
  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      {developer.logo ? (
        <FadeImage
          src={developer.logo}
          alt={developer.name}
          height={200}
          width={200}
          fill={false}
          className="rounded-md w-32 h-32 bg-muted"
          imageClassName="object-contain h-full w-full"
        />
      ) : (
        <div className="rounded-md w-32 h-32 bg-muted flex items-center justify-center">
          <Building2 className="size-10" />
        </div>
      )}
      <div className="flex flex-col flex-1 gap-2 items-center md:items-start">
        <div className="flex flex-col md:flex-row justify-between items-center w-full">
          <h2 className="text-2xl font-normal flex items-center gap-2 flex-wrap justify-center">
            {developer.name}
            <Badge variant="secondary">{t('works_count', { count: works_count })}</Badge>
          </h2>
          {developer.parent_developer && (
            <div className="flex items-center gap-2">
              <span>{t('parent_developer')}</span>
              <Badge variant="info" asChild>
                <Link
                  href={`/developer/${developer.parent_developer.id}`}
                  className="flex items-center gap-2"
                >
                  <Building2 className="size-4" />
                  <span>{developer.parent_developer.name}</span>
                </Link>
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {developer.aliases.length > 0 &&
            developer.aliases.map(alias => (
              <span key={alias} className="font-light">
                {alias}
              </span>
            ))}
        </div>
        {developer.website ? (
          <Link href={developer.website} target="_blank" className="flex items-center gap-2">
            <LinkIcon className="size-4" />
            {developer.website}
          </Link>
        ) : (
          <span className="flex items-center gap-2 select-none">
            <LinkIcon className="size-4" />
            {t('unknown')}
          </span>
        )}
      </div>
    </div>
  )
}
