import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useRouter } from '@/i18n/navigation.client'

interface QuestionProps {
  content?: string | React.ReactNode
  link?: string
  icon?: React.ElementType
  iconClassName?: string
  tooltipClassName?: string
  triggerClassName?: string
}

export const Question = ({
  content,
  link,
  icon = HelpCircle,
  iconClassName,
  tooltipClassName,
  triggerClassName,
}: QuestionProps) => {
  const IconComponent = icon
  const router = useRouter()

  const handleClick = () => {
    if (link) {
      router.push(link)
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild onClick={handleClick}>
        <span className={cn('inline-flex items-center', triggerClassName)}>
          <IconComponent className={cn('size-4 text-muted-foreground', iconClassName)} />
        </span>
      </TooltipTrigger>
      {content && <TooltipContent className={tooltipClassName}>{content}</TooltipContent>}
    </Tooltip>
  )
}
