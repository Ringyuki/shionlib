export const noComments = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Source code is comment-free; express intent through names and tests.' },
    messages: { comment: 'Remove the comment; express the intent through names and tests.' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: 'comment' })
        }
      },
    }
  },
}
