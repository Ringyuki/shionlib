'use client'

import { useState, useEffect } from 'react'
import { SerializedEditorState } from 'lexical'
import { Walkthrough, WalkthroughStatus } from '@/interfaces/walkthrough/walkthrough.interface'
import { WalkthroughEditor } from '@/components/common/walkthrough/Editor'
import { useScrollToElem } from '@/hooks/useScrollToElem'
import { Input } from '@/components/shionui/Input'
import { shionlibRequest } from '@/utils/request'
import { useRouter } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'

interface GameWalkthroughEditProps {
  walkthrough?: Walkthrough
  gameId: string
}

export const GameWalkthroughEdit = ({ walkthrough, gameId }: GameWalkthroughEditProps) => {
  const t = useTranslations('Components.Game.Walkthrough')
  const router = useRouter()
  const scrollTo = useScrollToElem({ updateHash: false })

  const [title, setTitle] = useState(walkthrough?.title ?? '')
  const [editorState, setEditorState] = useState<SerializedEditorState | undefined>(
    walkthrough?.content,
  )
  const [isDraftSubmitting, setIsDraftSubmitting] = useState(false)
  const [isPublishSubmitting, setIsPublishSubmitting] = useState(false)

  useEffect(() => {
    scrollTo('game-content')
  }, [scrollTo])

  const isSubmitDisabled =
    !title.trim() ||
    (!editorState && !walkthrough?.content) ||
    isDraftSubmitting ||
    isPublishSubmitting

  const handleSubmit = async (status: WalkthroughStatus.DRAFT | WalkthroughStatus.PUBLISHED) => {
    const content = editorState ?? walkthrough?.content
    if (!content) return

    const setLoading =
      status === WalkthroughStatus.DRAFT ? setIsDraftSubmitting : setIsPublishSubmitting
    setLoading(true)

    try {
      if (walkthrough) {
        await shionlibRequest().patch(`/walkthrough/${walkthrough.id}`, {
          data: { title, content, status },
        })
        sileo.success({ title: t('save_success') })
        status !== WalkthroughStatus.DRAFT &&
          router.push(`/game/${gameId}/walkthrough/${walkthrough.id}`)
      } else {
        const res = await shionlibRequest().post<{ id: number }>('/walkthrough', {
          data: { title, content, status, game_id: parseInt(gameId) },
        })
        sileo.success({ title: t('save_success') })
        router.push(`/game/${gameId}/walkthrough/${res.data!.id}`)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        size="lg"
        maxLength={50}
      />
      <WalkthroughEditor
        walkthrough={walkthrough}
        onSerializedChange={setEditorState}
        onDraft={() => handleSubmit(WalkthroughStatus.DRAFT)}
        isDraftSubmitting={isDraftSubmitting}
        onPublish={() => handleSubmit(WalkthroughStatus.PUBLISHED)}
        isPublishSubmitting={isPublishSubmitting}
        isSubmitDisabled={isSubmitDisabled}
      />
    </div>
  )
}
