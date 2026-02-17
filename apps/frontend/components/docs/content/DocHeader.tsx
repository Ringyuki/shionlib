import { DocsFrontmatter } from '@/interfaces/contents/docs.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Avatar } from '@/components/common/user/Avatar'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { CalendarDays } from 'lucide-react'

interface DocHeaderProps {
  frontmatter: DocsFrontmatter
}

export const DocHeader = ({ frontmatter }: DocHeaderProps) => {
  const locale = useLocale()
  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-video overflow-hidden rounded-lg">
        <FadeImage
          src={frontmatter.banner}
          alt={frontmatter.title}
          aspectRatio="16 / 9"
          className="w-full h-full object-cover"
          sizes="100vw"
        />
      </div>
      <h1 className="text-3xl font-bold">{frontmatter.title}</h1>
      <div className="flex items-center gap-2">
        <Avatar
          user={{
            id: frontmatter.author_uid,
            name: frontmatter.author_name,
            avatar: frontmatter.author_avatar,
          }}
          className="size-10"
        />
        <div className="flex flex-col justify-between h-full">
          <span className="text-sm font-semibold">{frontmatter.author_name}</span>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <CalendarDays className="size-3" />
            {timeFromNow(frontmatter.date, locale)}
          </span>
        </div>
      </div>
      <div className="bg-primary/10 text-primary rounded-md px-6 py-2 text-sm">
        {frontmatter.description}
      </div>
    </div>
  )
}
