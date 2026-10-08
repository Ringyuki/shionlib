import type { Viewer } from '~/features/viewer'
import { BioPanel } from './bio-panel'
import { NamePanel } from './name-panel'
import { PicturePanels } from './picture-panels'

export function PersonalSection({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <PicturePanels viewer={viewer} />
      <NamePanel key={viewer.name} current={viewer.name} />
      <BioPanel key={viewer.bio ?? ''} current={(viewer.bio ?? '').trim()} />
    </>
  )
}
