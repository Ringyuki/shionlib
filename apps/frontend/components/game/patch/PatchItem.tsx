import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'
import { Badge } from '@/components/shionui/Badge'
import { Avatar } from '@/components/common/user/Avatar'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { LanguageNameMap } from '@/interfaces/game/game.interface'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { PlatformMap } from './constants/platform'
import { LanguageMap } from './constants/language'
import { PatchResourceItem } from './PatchResourceItem'
import { markdownRender } from '@/utils/markdown/render'
import { TypeMap, TypeTokenMap } from './constants/type'
import { ScrollArea } from '@/components/shionui/ScrollArea'
import { DownloadIcon } from 'lucide-react'

interface GameDownloadResourceItemProps {
  patch: KunPatchResourceResponse
}

export const PatchItem = ({ patch }: GameDownloadResourceItemProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.Game.Patch.PatchItem')

  return (
    <div
      key={patch.id}
      className="flex flex-col gap-2 rounded-lg border border-accent p-4 break-words break-all"
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {patch.type?.map(p => {
              return (
                <Badge
                  key={p}
                  variant="neutral"
                  style={{
                    borderColor: TypeTokenMap[p].text,
                    color: TypeTokenMap[p].text,
                    backgroundColor: TypeTokenMap[p].bg,
                  }}
                >
                  {t(`type.${TypeMap[p]}`)}
                </Badge>
              )
            })}
            <GamePlatform platform={patch.platform.map(p => PlatformMap[p])} />
            {patch.language?.map(l => {
              return (
                <Badge key={l} variant="neutral">
                  {LanguageNameMap[LanguageMap[l]]}
                </Badge>
              )
            })}
            {patch.model_name && (
              <Badge size="sm" variant="secondary">
                {patch.model_name}
              </Badge>
            )}
            {patch.localization_group_name && (
              <Badge size="sm" variant="secondary">
                {patch.localization_group_name}
              </Badge>
            )}
            <Badge size="sm" variant="secondary">
              <DownloadIcon className="size-3" />
              {patch.download}
            </Badge>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <Avatar
              user={patch.user}
              homeUrl={`https://www.moyu.moe/user/${patch.user.id}`}
              className="size-6 text-xs"
            />
            <span className="text-muted-foreground text-xs font-light flex items-center gap-1">
              <span>{t('created')}</span>
              {timeFromNow(patch.created, locale)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg w-full">
        <PatchResourceItem patch={patch} />
        {patch.note && (
          <ScrollArea className="text-xs font-light font-mono! pl-2 max-h-[200px]">
            <span className="space-y-2">{markdownRender(patch.note, { newlineToBr: true })}</span>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
