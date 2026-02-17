import { Separator } from '@/components/shionui/Separator'
import { cn } from '@/utils/cn'

interface GameTitleProps {
  title: string
  excess_titles: string[]
  aliases: string[]
  type: string
  className?: string
}

export const GameTitle = ({ title, excess_titles, aliases, type, className }: GameTitleProps) => {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="text-3xl font-bold flex gap-2">
        <h1>{title}</h1>
      </div>
      {excess_titles.length > 0 && (
        <div className="text-lg font-normal flex flex-wrap items-center gap-2">
          <h1 className="flex items-center flex-wrap">
            {excess_titles.map((t, i) => (
              <span key={`${t}-${i}`} className="flex items-center">
                {i > 0 && (
                  <Separator orientation="vertical" className="mx-2 h-4! hidden md:block" />
                )}
                {t}
              </span>
            ))}
          </h1>
        </div>
      )}
      {(aliases.length > 0 || type) && (
        <div className="flex flex-wrap items-center gap-2 text-gray-500 font-light">
          {aliases.length > 0 && <h1>{aliases.join(', ')}</h1>}
          {type && <h1>{type}</h1>}
        </div>
      )}
    </div>
  )
}
