import { shionlibRequest } from '@/utils/request'
import { OverviewData } from '@/interfaces/analysis/data.interface'
import { Gamepad2, HardDrive, Download, FileArchive } from 'lucide-react'
import { formatBytes, formatNumber } from '@/utils/format'
import { getTranslations } from 'next-intl/server'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'

export const Overview = async () => {
  const { data } = await shionlibRequest().get<OverviewData>('/analysis/data/overview')
  const t = await getTranslations('Components.Home.Hero.Overview')
  return (
    <div className="grid-cols-2 gap-4 hidden md:grid select-none">
      <div className="flex flex-col justify-around shadow-card border rounded-md p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--primary-200)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--primary-950)_0%,_transparent_50%)]">
        <div className="flex items-center gap-2">
          <h3 className="text-base text-muted-foreground">{t('games')}</h3>
          <Gamepad2 className="size-8 text-primary ml-auto" />
        </div>
        <span className="text-3xl font-bold">{formatNumber(data?.games ?? 0)}</span>
      </div>
      <div className="flex flex-col justify-around shadow-card border rounded-md p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--purple-200)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--purple-950)_0%,_transparent_50%)]">
        <div className="flex items-center gap-2">
          <h3 className="text-base text-muted-foreground">{t('files')}</h3>
          <FileArchive className="size-8 text-purple-600 ml-auto" />
        </div>
        <span className="text-3xl font-bold">{formatNumber(data?.files ?? 0)}</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col justify-around shadow-card border rounded-md p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--success-200)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--success-950)_0%,_transparent_50%)]">
            <div className="flex items-center gap-2">
              <h3 className="text-base text-muted-foreground">{t('storage')}</h3>
              <HardDrive className="size-8 text-success ml-auto" />
            </div>
            <span className="text-3xl font-bold">{formatBytes(data?.storage ?? 0)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {formatBytes(data?.storage ?? 0, { unit: 'GB', decimals: 4 })}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col justify-around shadow-card border rounded-md p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--warning-200)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--warning-950)_0%,_transparent_50%)]">
            <div className="flex items-center gap-2">
              <h3 className="text-base text-muted-foreground">{t('24-hour-traffic')}</h3>
              <Download className="size-8 text-warning ml-auto" />
            </div>
            <span className="text-3xl font-bold">{formatBytes(data?.bytes_gotten ?? 0)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {formatBytes(data?.bytes_gotten ?? 0, { unit: 'GB', decimals: 4 })}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
