'use client'

import { useState, useRef } from 'react'
import { CommentEditor } from './CommentEditor'
import { shionlibRequest } from '@/utils/request'
import { SerializedEditorState } from 'lexical'
import { useTranslations } from 'next-intl'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Comment } from '@/interfaces/comment/comment.interface'
import { useCommentListStore } from '@/store/commentListStore'

interface CommentBoxProps {
  game_id: string
  parent_id?: string
  onSubmitSuccess?: () => void
}

export const CommentBox = ({ game_id, parent_id, onSubmitSuccess }: CommentBoxProps) => {
  const t = useTranslations('Components.Common.Comment.CommentBox')
  const [isLoading, setIsLoading] = useState(false)
  const editorRef = useRef<{ clearEditor: () => void } | null>(null)
  const { addComment } = useCommentListStore()

  const handleSubmit = async (serialized: SerializedEditorState) => {
    setIsLoading(true)
    try {
      const data = await shionlibRequest().post<Comment>(`/comment/game/${game_id}`, {
        data: {
          content: serialized,
          parent_id: parent_id ? Number(parent_id) : null,
        },
      })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      addComment(data.data!)
      editorRef.current?.clearEditor()
      onSubmitSuccess?.()
    } catch {
    } finally {
      setIsLoading(false)
    }
  }
  return <CommentEditor onSubmit={handleSubmit} isSubmitting={isLoading} ref={editorRef} />
}
