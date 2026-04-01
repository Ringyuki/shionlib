import { shionlibRequest } from '@/utils/request/request'
import { Ad } from '@/interfaces/site/ad.interface'

export const fetchAdsByPlacement = async (placement: string): Promise<Ad[]> => {
  try {
    const res = await shionlibRequest({ forceNotThrowError: true }).get<Ad[]>(
      `/ad/placement/${placement}`,
    )
    return res.data ?? []
  } catch {
    return []
  }
}
