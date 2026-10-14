import type { Shown } from '../ad'
import { AdBanner } from './ad-banner'

export function DownloadBanner({ ads }: { ads: Shown[] }) {
  const [ad] = ads
  return ad === undefined ? null : <AdBanner ad={ad} slot="download" className="rounded-md" />
}
