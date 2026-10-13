import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useId, type ReactNode } from 'react'

export type SortSpeech = {
  instructions: string
  picked: (id: string) => string
  moved: (id: string, position: number) => string
  dropped: (id: string, position: number) => string
  cancelled: (id: string) => string
}

type SortableProps = {
  ids: readonly string[]
  speech: SortSpeech
  onMove: (id: string, over: string) => void
  children: ReactNode
}

const upright: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const started = { distance: 4 }

export function Sortable({ ids, speech, onMove, children }: SortableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: started }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const context = useId()
  const place = (id: UniqueIdentifier | undefined) => ids.indexOf(String(id)) + 1
  const end = ({ active, over }: DragEndEvent) => {
    if (over !== null && active.id !== over.id) {
      onMove(String(active.id), String(over.id))
    }
  }
  return (
    <DndContext
      id={context}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[upright]}
      onDragEnd={end}
      accessibility={{
        screenReaderInstructions: { draggable: speech.instructions },
        announcements: {
          onDragStart: ({ active }) => speech.picked(String(active.id)),
          onDragOver: ({ active, over }) =>
            over === null ? undefined : speech.moved(String(active.id), place(over.id)),
          onDragEnd: ({ active, over }) =>
            over === null
              ? speech.cancelled(String(active.id))
              : speech.dropped(String(active.id), place(over.id)),
          onDragCancel: ({ active }) => speech.cancelled(String(active.id)),
        },
      }}
    >
      <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function useSortableRow(id: string, role: string) {
  const sortable = useSortable({ id, attributes: { roleDescription: role } })
  return {
    setRow: sortable.setNodeRef,
    setHandle: sortable.setActivatorNodeRef,
    moving: {
      transform: CSS.Translate.toString(sortable.transform),
      transition: sortable.transition,
    },
    grip: { ...sortable.attributes, ...sortable.listeners },
    dragging: sortable.isDragging,
  }
}
