import { Badge } from '@/components/shionui/Badge'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  RelationTone,
  RELATION_ICON_TONE_CLASSNAME,
  RELATION_TEXT_TONE_CLASSNAME,
} from '../constants/edit-changes'
import { ChangeValuePanel } from './ChangeValuePanel'

interface RelationListSectionProps {
  title: string
  items: unknown[]
  tone: RelationTone
  emptyLabel: string
}

export const RelationListSection = ({
  title,
  items,
  tone,
  emptyLabel,
}: RelationListSectionProps) => {
  const Icon = tone === 'add' ? Plus : Minus

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'size-4',
            RELATION_ICON_TONE_CLASSNAME[tone] ?? RELATION_ICON_TONE_CLASSNAME.add,
          )}
        />
        <span
          className={cn(
            'text-sm font-medium',
            RELATION_TEXT_TONE_CLASSNAME[tone] ?? RELATION_TEXT_TONE_CLASSNAME.add,
          )}
        >
          {title}
        </span>
        {/* <Badge variant="neutral" className="font-mono! text-xs">
          {items.length}
        </Badge> */}
      </div>
      <div className="pl-6 flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-col gap-1">
            {/* <Badge variant="neutral" className="font-mono! text-xs w-fit">
              #{index + 1}
            </Badge> */}
            <ChangeValuePanel value={item} tone={tone} emptyLabel={emptyLabel} />
          </div>
        ))}
      </div>
    </div>
  )
}
