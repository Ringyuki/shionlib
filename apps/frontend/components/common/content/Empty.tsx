import {
  Empty as EmptyComponent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyAction,
} from '@/components/shionui/Empty'
import { FadeImage } from '../shared/FadeImage'
import { useTranslations } from 'next-intl'

interface EmptyProps {
  title?: string
  description?: string
  action?: React.ReactNode
}

export const Empty = ({ title, description, action }: EmptyProps) => {
  const t = useTranslations('Components.Common.Content.Empty')
  return (
    <EmptyComponent>
      <EmptyHeader>
        <EmptyMedia>
          <FadeImage
            width={200}
            height={267.48}
            fill={false}
            className="w-48 h-auto"
            src="/assets/images/empty.webp"
            alt="Empty"
            localFile
          />
        </EmptyMedia>
        <EmptyTitle className="text-muted-foreground">{title || t('title')}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
        {action && <EmptyAction className="mt-4">{action}</EmptyAction>}
      </EmptyHeader>
    </EmptyComponent>
  )
}
