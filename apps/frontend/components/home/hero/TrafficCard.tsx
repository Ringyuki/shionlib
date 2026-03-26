'use client'

import { useState } from 'react'
import { Download, ChevronRight } from 'lucide-react'
import { formatBytes } from '@/utils/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { TrafficDetailModal } from './TrafficDetailModal'

interface TrafficCardProps {
  bytesGotten: number
  label: string
}

export const TrafficCard = ({ bytesGotten, label }: TrafficCardProps) => {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="group flex cursor-pointer flex-col justify-around shadow-card border rounded-md p-4 bg-[radial-gradient(ellipse_at_top_right,var(--warning-200)_0%,transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,var(--warning-950)_0%,transparent_50%)]"
            onClick={() => setModalOpen(true)}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-base text-muted-foreground flex items-center gap-1">
                {label}
                <ChevronRight className="transition-transform size-4 group-hover:translate-x-0.5 group-hover:text-warning" />
              </h3>
              <Download className="size-8 text-warning ml-auto" />
            </div>
            <span className="text-3xl font-bold">{formatBytes(bytesGotten)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{formatBytes(bytesGotten, { unit: 'GB', decimals: 4 })}</TooltipContent>
      </Tooltip>
      <TrafficDetailModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
