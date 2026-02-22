import { useTranslations } from 'next-intl'
import { CardContent } from '@/components/shionui/Card'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'
import { useMemo } from 'react'
import { timeFormat, TimeFormatEnum } from '@/utils/time-format'
import { useLocale } from 'next-intl'

interface StatusProps {
  isConnected: boolean
  binding: PVNBindingInfo
}

export const Status = ({ isConnected, binding }: StatusProps) => {
  const t = useTranslations('Components.User.Settings.Connections.PotatoVN')
  const locale = useLocale()
  const tokenStatus = useMemo(() => {
    if (!binding) return null
    const expires = new Date(binding.pvn_token_expires)
    // eslint-disable-next-line react-hooks/purity
    const msLeft = expires.getTime() - Date.now()
    const isExpired = msLeft <= 0
    const isExpiringSoon = !isExpired && msLeft < 7 * 24 * 60 * 60 * 1000
    const dateStr = timeFormat(expires, locale, TimeFormatEnum.YYYY_MM_DD)
    return { isExpired, isExpiringSoon, dateStr }
  }, [binding, locale])
  return (
    isConnected &&
    tokenStatus && (
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">
          {t('connectedAs')}{' '}
          <span className="font-medium text-foreground">{binding.pvn_user_name}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t('tokenExpires')}{' '}
          <span
            className={
              tokenStatus.isExpired
                ? 'font-medium text-destructive'
                : tokenStatus.isExpiringSoon
                  ? 'font-medium text-warning'
                  : 'font-medium text-foreground'
            }
          >
            {tokenStatus.dateStr}
            {tokenStatus.isExpired && ` · ${t('tokenExpired')}`}
            {tokenStatus.isExpiringSoon && ` · ${t('tokenExpiresSoon')}`}
          </span>
        </p>
      </CardContent>
    )
  )
}
