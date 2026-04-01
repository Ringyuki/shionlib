import { fetchAdsByPlacement } from '@/libs/ad/fetch-ads'
import { AdList } from './AdItem'

export const AdSlot = async ({ placement }: { placement: string }) => {
  const ads = await fetchAdsByPlacement(placement)
  return <AdList ads={ads} />
}

export { AdSlotClient } from './AdSlotClient'
