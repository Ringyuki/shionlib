import { useState } from 'react'

type Desk = { opened: number | undefined; adopted: number | undefined; turn: number }

export function useWritingDesk(walkthroughId: number | undefined) {
  const [desk, setDesk] = useState<Desk>({ opened: walkthroughId, adopted: walkthroughId, turn: 0 })
  if (walkthroughId !== desk.opened && walkthroughId !== desk.adopted) {
    setDesk({ opened: walkthroughId, adopted: walkthroughId, turn: desk.turn + 1 })
  } else if (walkthroughId === desk.adopted && desk.opened !== desk.adopted) {
    setDesk({ ...desk, opened: desk.adopted })
  }
  return {
    turn: desk.turn,
    adopt: (created: number) => setDesk(current => ({ ...current, adopted: created })),
  }
}
