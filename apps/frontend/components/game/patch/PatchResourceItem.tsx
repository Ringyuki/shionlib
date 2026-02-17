import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'
import { FileArchive, CloudCheck, Hash, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { Button } from '@/components/shionui/Button'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CopyButton } from '@/components/shionui/animated/CopyButton'

interface PatchResourceItemProps {
  patch: KunPatchResourceResponse
}

export const PatchResourceItem = ({ patch }: PatchResourceItemProps) => {
  const t = useTranslations('Components.Game.Patch.PatchResourceItem')
  return (
    <div className="flex gap-2 justify-between items-center border-dashed border p-2 rounded-lg w-full">
      <div className="flex flex-col items-start gap-2">
        <div className="text-sm font-medium font-mono! flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1">
            <FileArchive className="size-3 shrink-0" />
            {patch.name && <span>{patch.name}</span>}
          </span>
          <span className="text-muted-foreground text-xs">{patch.size}</span>
          {patch.storage === 's3' && (
            <Badge size="sm" variant="success">
              <CloudCheck className="size-3" />
              S3
            </Badge>
          )}
        </div>
        {patch.hash && (
          <div className="text-muted-foreground text-xs flex items-center gap-1 break-words break-all">
            <Hash className="size-3 shrink-0" />
            <span className="break-words break-all">{'BLAKE3 ' + patch.hash}</span>
            <CopyButton content={patch.hash} size="xs" variant="ghost" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`https://www.moyu.moe/resource/${patch.id}`} target="_blank">
              <Button
                size="icon"
                renderIcon={<ExternalLink className="size-4" />}
                intent="primary"
                appearance="soft"
                className="size-8"
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <span>{t('viewOnMoyu')}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
