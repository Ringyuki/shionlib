import { useEffect, useEffectEvent } from 'react'
import { useFetcher } from 'react-router'
import type { ApiFailure } from '~/shared/api/types'
import type {
  FileRemoval,
  FileRename,
  ResourceDeletion,
  ResourceEdit,
  ResourceReport,
} from './resource.schema'
import type { editResourceAction } from './resource.server'

type CommandAction = typeof editResourceAction

type CommandOptions = {
  onDone: () => void
  onFailure?: (failure: ApiFailure) => void
  revalidate?: boolean
}

export function useResourceCommand<
  Command extends ResourceReport | ResourceEdit | ResourceDeletion | FileRename | FileRemoval,
>(action: string, { onDone, onFailure, revalidate = true }: CommandOptions) {
  const fetcher = useFetcher<CommandAction>()
  const settle = useEffectEvent((result: NonNullable<typeof fetcher.data>) => {
    if (result.ok) {
      onDone()
    } else {
      onFailure?.(result.failure)
    }
  })
  const settled = fetcher.state === 'submitting' ? undefined : fetcher.data
  useEffect(() => {
    if (settled !== undefined) {
      settle(settled)
    }
  }, [settled])
  const submit = (command: Command) =>
    fetcher.submit(command, {
      method: 'post',
      action,
      encType: 'application/json',
      defaultShouldRevalidate: revalidate,
    })
  return {
    submit,
    pending: fetcher.state !== 'idle',
    failure: fetcher.data?.ok === false ? fetcher.data.failure : undefined,
  }
}
