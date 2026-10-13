import { cn, Image } from '@hina-ui/react'
import { managerLogos, type Manager } from '~/shared/vendor/managers'

export function ManagerLogo({ manager, className }: { manager: Manager; className?: string }) {
  return (
    <Image
      src={managerLogos[manager]}
      alt=""
      ratio={1}
      fit="contain"
      eager
      lazy={false}
      skeleton={false}
      className={cn('shrink-0 rounded-sm', className)}
    />
  )
}
