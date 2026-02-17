import { Alert, AlertDescription, AlertTitle } from '../shionui/Alert'
import { Info, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export const CreateAlert = () => {
  const t = useTranslations('Components.Create.Alert')
  return (
    <>
      <Alert className="mt-4" intent="info" appearance="solid">
        <Info />
        <AlertTitle>{t('info')}</AlertTitle>
        <AlertDescription>{t('infoDescription')}</AlertDescription>
      </Alert>
      <Alert className="mt-4" intent="warning" appearance="solid">
        <AlertCircle />
        <AlertTitle>{t('warning')}</AlertTitle>
        <AlertDescription>
          <span>{t('warningDescription')}</span>
          <ol>
            <ErrorCodeDescription errorCode="400103" description={t('errorCodes.400103')} />
            <ErrorCodeDescription errorCode="400104" description={t('errorCodes.400104')} />
            <ErrorCodeDescription errorCode="400105" description={t('errorCodes.400105')} />
            <ErrorCodeDescription errorCode="400106" description={t('errorCodes.400106')} />
          </ol>
        </AlertDescription>
      </Alert>
    </>
  )
}

const ErrorCodeDescription = ({
  errorCode,
  description,
}: {
  errorCode: string
  description: string
}) => {
  return (
    <li>
      <span className="font-bold text-red-700">{errorCode}</span> - {description}
    </li>
  )
}
