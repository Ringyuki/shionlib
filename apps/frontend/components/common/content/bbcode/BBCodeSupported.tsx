import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { Info } from 'lucide-react'
import { BBCodeContent } from './BBCode'
import { useTranslations } from 'next-intl'

interface BBCodeSupportedProps {
  title?: string
  showDescription?: boolean
  description?: string
  exampleTitle?: string
  example?: string
}

export const BBCodeSupported = ({
  title,
  showDescription = false,
  description,
  exampleTitle,
  example,
}: BBCodeSupportedProps) => {
  const t = useTranslations('Components.Common.Content.BBCodeSupported')
  return (
    <Alert appearance="solid">
      <Info />
      <AlertTitle>{title ?? t('title')}</AlertTitle>
      {showDescription && description && (
        <AlertDescription>
          <BBCodeContent content={description} />
        </AlertDescription>
      )}
      <AlertDescription>{exampleTitle ?? t('exampleTitle')}</AlertDescription>
      <AlertDescription className="flex md:gap-20 max-w-full overflow-x-auto scrollbar-hide">
        <BBCodeContent content={example ?? t('example')} onlyBr />
        <BBCodeContent content={example ?? t('example')} />
      </AlertDescription>
    </Alert>
  )
}
