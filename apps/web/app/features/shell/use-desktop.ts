import { useMedia } from '~/shared/ui/use-media'

export function useDesktop(): boolean {
  return useMedia('(min-width: 1024px)', true)
}
