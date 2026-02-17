import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

interface QuestionProps {
  content: string | React.ReactNode
  icon?: React.ElementType
  iconClassName?: string
  tooltipClassName?: string
  triggerClassName?: string
}

export const Question = ({
  content,
  icon = HelpCircle,
  iconClassName,
  tooltipClassName,
  triggerClassName,
}: QuestionProps) => {
  const IconComponent = icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center', triggerClassName)}>
          <IconComponent className={cn('size-4 text-muted-foreground', iconClassName)} />
        </span>
      </TooltipTrigger>
      <TooltipContent className={tooltipClassName}>{content}</TooltipContent>
    </Tooltip>
  )
}
