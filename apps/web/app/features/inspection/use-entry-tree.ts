import { useCallback, useMemo, useState } from 'react'
import {
  entriesById,
  expandable,
  meaningOf,
  treeOf,
  wanting,
  withPage,
  type Contents,
  type EntryPage,
} from './inspection'
import { openedOf, type Opened } from './inspection-preview'

type NodeValue = number | string

export function useEntryTree(contents: Contents, onOpen: (opened: Opened) => void) {
  const [branches, setBranches] = useState(contents.branches)
  const [expanded, setExpanded] = useState<NodeValue[]>(contents.expanded)
  const items = useMemo(() => treeOf(branches), [branches])
  const known = useMemo(() => entriesById(branches), [branches])
  const meaning = (value: NodeValue) => meaningOf(branches, known, value)
  const deliver = useCallback(
    (parent: number | null, page: EntryPage) => setBranches(known => withPage(known, parent, page)),
    [],
  )
  const choose = (value: NodeValue) => {
    const chosen = meaning(value)
    if (chosen?.kind === 'more') {
      setBranches(known => wanting(known, chosen.parent))
      return
    }
    if (chosen?.kind !== 'entry') {
      return
    }
    if (expandable(chosen.entry)) {
      setExpanded(open =>
        open.includes(value) ? open.filter(other => other !== value) : [...open, value],
      )
      return
    }
    if (chosen.entry.preview !== null) {
      onOpen(openedOf(branches, known, chosen.entry))
    }
  }
  return { items, meaning, expanded, setExpanded, deliver, choose }
}
