import { Badge } from '@/components/shionui/Badge'

interface GameTagsProps {
  tags: string[]
}

export const GameTags = ({ tags }: GameTagsProps) => {
  return (
    tags.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge key={tag} variant="outline" className="select-none">
            {tag}
          </Badge>
        ))}
      </div>
    )
  )
}
