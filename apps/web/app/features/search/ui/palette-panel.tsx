import { Divider, Stack, type InputHandle, type ListboxValue } from '@hina-ui/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useImageSearch } from '../use-image-search'
import { usePaletteEntries } from '../use-palette-entries'
import type { PaletteSource } from '../use-palette-source'
import { useSearchPalette } from '../use-search-palette'
import { ImageSearchPanel } from './image-search-panel'
import { PaletteInput } from './palette-input'
import { PaletteResults } from './palette-results'

export function PalettePanel({ source, onClose }: { source: PaletteSource; onClose: () => void }) {
  const palette = useSearchPalette(source, onClose)
  const image = useImageSearch()
  const { entries, recentShown, status, searchAll } = usePaletteEntries(palette)
  const input = useRef<InputHandle>(null)
  const list = useRef<HTMLElement>(null)
  const [refills, setRefills] = useState(0)
  useEffect(() => {
    if (refills > 0) {
      input.current?.focus()
    }
  }, [refills])
  const pick = (value: ListboxValue) => {
    const entry = entries
      .flatMap(item => ('options' in item ? item.options : [item]))
      .find(option => option.value === value)
    entry?.action()
    if (entry?.stays === true) {
      setRefills(count => count + 1)
    }
  }
  const enterList = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      list.current?.focus()
    }
  }
  const type = (value: string) => {
    if (image.on) {
      image.close()
    }
    palette.setSearch(value)
  }
  return (
    <Stack gap="none">
      <PaletteInput
        input={input}
        value={palette.search}
        onValueChange={type}
        onKeyDown={enterList}
        canSearch={palette.query !== ''}
        onSearch={searchAll}
        imageOn={image.on}
        onImageChange={on => (on ? image.open() : image.close())}
      />
      <Divider />
      {image.on ? (
        <ImageSearchPanel
          control={image}
          source={source.of('')?.imageSource ?? null}
          list={list}
          onClose={onClose}
        />
      ) : (
        <PaletteResults
          entries={entries}
          recentShown={recentShown}
          status={status}
          query={palette.query}
          list={list}
          onPick={pick}
          onClearRecent={() => {
            palette.clearRecent()
            setRefills(count => count + 1)
          }}
        />
      )}
    </Stack>
  )
}
