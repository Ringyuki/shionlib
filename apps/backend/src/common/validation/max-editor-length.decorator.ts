import { registerDecorator, ValidationOptions } from 'class-validator'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

function extractText(node: SerializedLexicalNode): string {
  if ('text' in node) return node.text as string
  if ('children' in node)
    return (node.children as SerializedLexicalNode[]).map(extractText).join('')
  return ''
}

export function getEditorTextLength(state: SerializedEditorState): number {
  return extractText(state.root as SerializedLexicalNode).length
}

export function MaxEditorLength(max: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxEditorLength',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options,
      validator: {
        validate(value: unknown) {
          if (!value || typeof value !== 'object') return false
          return getEditorTextLength(value as SerializedEditorState) <= max
        },
        defaultMessage() {
          return `${propertyName} must be shorter than or equal to ${max} characters`
        },
      },
    })
  }
}
