import { DropdownMenuItem } from '@/components/shionui/DropdownMenu'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useShionlibUserStore } from '@/store/userStore'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { CommentEditor } from '../CommentEditor'
import { SerializedEditorState } from 'lexical'
import { shionlibRequest } from '@/utils/request'
import { RawComment } from '@/interfaces/comment/raw.interface'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useCommentListStore } from '@/store/commentListStore'
import { Comment } from '@/interfaces/comment/comment.interface'

interface EditProps {
  creator_id: number
  comment_id: number
  onEdited?: () => void
}

const getContent = async (comment_id: number) => {
  const response = await shionlibRequest().get<RawComment>(`/comment/${comment_id}/raw`)
  return response.data
}

export const Edit = ({ creator_id, comment_id, onEdited }: EditProps) => {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<SerializedEditorState>()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [getLoading, setGetLoading] = useState(false)
  const { user } = useShionlibUserStore()
  const { updateComment } = useCommentListStore()
  const t = useTranslations('Components.Common.Comment.Actions.Edit')

  const handleOpen = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    try {
      setGetLoading(true)
      const rawContent = await getContent(comment_id)
      setContent(rawContent?.content)
      setOpen(true)
    } catch {
    } finally {
      setGetLoading(false)
    }
  }

  const handleEdit = async (updatedContent: SerializedEditorState) => {
    try {
      setSubmitLoading(true)
      const date = await shionlibRequest().patch<Comment>(`/comment/${comment_id}`, {
        data: {
          content: updatedContent,
        },
      })
      updateComment(date.data!)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      setOpen(false)
      onEdited?.()
    } catch {
    } finally {
      setSubmitLoading(false)
    }
  }
  return (
    <>
      <DropdownMenuItem
        className="cursor-pointer duration-200"
        onClick={handleOpen}
        disabled={(creator_id !== user.id && user.role !== 3) || getLoading}
      >
        <Pencil />
        {t('edit')}
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="w-full min-w-0 sm:max-w-3xl md:max-w-5xl"
        >
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <CommentEditor
            key={`${comment_id}-${open}`}
            onSubmit={handleEdit}
            isSubmitting={submitLoading}
            _initialValue={content}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
