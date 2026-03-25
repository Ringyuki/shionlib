import { Heart } from 'lucide-react'
import { cn } from '@/utils/cn'
import { SponsorModal } from '@/components/sponsor/SponsorModal'
import { useState } from 'react'

export const SponsorBadge = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className={cn(
          'absolute flex items-center justify-center hover:brightness-90 transition-all cursor-pointer',
          className,
        )}
        style={{
          bottom: '-4%',
          right: '-4%',
          width: '36%',
          height: '36%',
        }}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Heart className="fill-destructive text-foreground size-full" strokeWidth={1} />
      </button>
      <SponsorModal open={open} onOpenChange={setOpen} />
    </>
  )
}
