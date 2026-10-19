import { Center, Image } from '@hina-ui/react'
import { Building2 } from 'lucide-react'

type DeveloperLogoProps = {
  src: string | null
  thumbhash: string | null
  className: string
  eager?: boolean
}

export function DeveloperLogo({ src, thumbhash, className, eager }: DeveloperLogoProps) {
  return (
    <Image
      src={src ?? undefined}
      thumbhash={thumbhash ?? undefined}
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
