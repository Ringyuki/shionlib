import { Separator } from '@/components/shionui/Separator'
import { cn } from '@/utils/cn'

interface PageHeaderProps {
  children: React.ReactNode
  showSeparator?: boolean
}

const PageHeader = ({ children, showSeparator = true }: PageHeaderProps) => {
  return (
    <div className="flex flex-col">
      {children}
      {showSeparator && <Separator className="my-6" />}
    </div>
  )
}

interface PageHeaderTitleProps {
  title: string
  className?: string
}

const PageHeaderTitle = ({ title, className }: PageHeaderTitleProps) => {
  return <h1 className={cn('text-3xl font-medium py-2', className)}>{title}</h1>
}

interface PageHeaderDescriptionProps {
  description: string | React.ReactNode
}

const PageHeaderDescription = ({ description }: PageHeaderDescriptionProps) => {
  return <p className="text-muted-foreground py-0.25">{description}</p>
}

export { PageHeader, PageHeaderTitle, PageHeaderDescription }
