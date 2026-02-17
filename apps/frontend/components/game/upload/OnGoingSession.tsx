import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { UploadSession } from '@/interfaces/upload/upload-session.interface'
import { useTranslations } from 'next-intl'
import { timeFromNow } from '@/utils/time-format'
import { SupportedLocales } from '@/config/i18n/supported'
import { useLocale } from 'next-intl'
import { FileArchive, StepForward, Square } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shionui/Tooltip'
import { Phase } from '@/libs/uploader/types'

interface OnGoingSessionProps {
  onResume: (sessionId: number) => void
  phase: Phase
}

export const OnGoingSession = ({ onResume, phase }: OnGoingSessionProps) => {
  const t = useTranslations('Components.Game.Upload.OnGoingSession')
  const locale = useLocale() as SupportedLocales
  const [onGoingSession, setOnGoingSession] = useState<UploadSession[]>([])
  useEffect(() => {
    const fetchOnGoingSession = async () => {
      const res = await shionlibRequest().get<UploadSession[]>('/uploads/large/ongoing')
      setOnGoingSession(res.data!)
    }
    fetchOnGoingSession()
  }, [])

  const handleCancel = async (sessionId: number) => {
    try {
      await shionlibRequest().delete(`/uploads/large/${sessionId}`)
      setOnGoingSession(onGoingSession.filter(session => session.upload_session_id !== sessionId))
    } catch {}
  }

  const disabled = phase !== 'idle'
  return (
    onGoingSession.length > 0 && (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <div className="flex flex-col gap-2">
          {onGoingSession.map(session => (
            <div
              key={session.upload_session_id}
              className="border p-2 rounded-md flex justify-between gap-2"
            >
              <div className="text-sm flex gap-2 items-center">
                <FileArchive className="size-4 shrink-0" />
                <span>{session.file_name}</span>
                <span className="text-muted-foreground text-xs flex gap-1 items-center shrink-0">
                  <span>{timeFromNow(session.expires_at, locale)}</span>
                  <span>{t('expires')}</span>
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        disabled={disabled}
                        className="w-6 h-6"
                        intent="success"
                        appearance="soft"
                        size="icon"
                        onClick={() => onResume(session.upload_session_id)}
                        renderIcon={<StepForward className="size-3" />}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('resume')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        disabled={disabled}
                        className="w-6 h-6"
                        intent="destructive"
                        appearance="soft"
                        size="icon"
                        onClick={() => handleCancel(session.upload_session_id)}
                        renderIcon={<Square className="size-3" />}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('cancel')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  )
}
