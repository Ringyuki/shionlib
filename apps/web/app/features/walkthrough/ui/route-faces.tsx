import { Avatar, AvatarGroup, Flex } from '@hina-ui/react'
import { useFaceImage } from '~/shared/ui/use-face-image'
import { portraitsShown, type Portrait } from '../walkthrough'

const facePixels = 32

export function RouteFaces({ portraits }: { portraits: readonly Portrait[] }) {
  const faceOf = useFaceImage()
  if (portraits.length === 0) {
    return null
  }
  return (
    <Flex as="span" aria-hidden className="shrink-0">
      <AvatarGroup max={portraits.length > portraitsShown ? portraitsShown - 1 : portraitsShown}>
        {portraits.map(each => (
          <Avatar
            key={each.id}
            alt=""
            imageClass="object-top"
            {...faceOf(each.picture, facePixels)}
          />
        ))}
      </AvatarGroup>
    </Flex>
  )
}
