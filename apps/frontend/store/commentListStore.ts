'use client'

import { create } from 'zustand'
import { Comment } from '@/interfaces/comment/comment.interface'

interface CommentListStore {
  comments: Comment[]
  setComments: (comments: Comment[]) => void
  addComment: (comment: Comment) => void
  removeComment: (comment_id: number) => void
  updateComment: (comment: Comment) => void
  getComment: (comment_id: number) => Comment | undefined
  getLength: () => number
}

export const useCommentListStore = create<CommentListStore>()((set, get) => ({
  comments: [],
  setComments: (comments: Comment[]) => set({ comments }),
  addComment: (comment: Comment) => set(state => ({ comments: [...state.comments, comment] })),
  removeComment: (comment_id: number) =>
    set(state => ({ comments: state.comments.filter(c => c.id !== comment_id) })),
  updateComment: (comment: Comment) =>
    set(state => ({ comments: state.comments.map(c => (c.id === comment.id ? comment : c)) })),
  getComment: (comment_id: number) => get().comments.find(c => c.id === comment_id),
  getLength: () => get().comments.length,
}))
