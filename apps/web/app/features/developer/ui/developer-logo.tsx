import { Center, Image } from '@hina-ui/react'
import { Building2 } from 'lucide-react'

type DeveloperLogoProps = {
  src: string | null
  className: string
  eager?: boolean
}

export function DeveloperLogo({ src, className, eager }: DeveloperLogoProps) {
  return (
    <Image
      src={src ?? undefined}
      alt=""
      ratio={1}
      fit="contain"
      eager={eager}
      empty={
        <Center className="size-full text-muted">
          <Building2 aria-hidden className="size-1/2" />
        </Center>
      }
      className={className}
    />
  )
}
