import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { HashtagNode } from '@lexical/hashtag'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { OverflowNode } from '@lexical/overflow'
import { HorizontalRuleNode } from '@lexical/extension'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { Klass, LexicalNode, LexicalNodeReplacement, ParagraphNode, TextNode } from 'lexical'

import { AutocompleteNode } from '@/components/editor/libs/nodes/autocomplete-node'
import { EmojiNode } from '@/components/editor/libs/nodes/emoji-node'
import { ImageNode } from '@/components/editor/libs/nodes/image-node'
import { KeywordNode } from '@/components/editor/libs/nodes/keyword-node'
import { LayoutContainerNode } from '@/components/editor/libs/nodes/layout-container-node'
import { LayoutItemNode } from '@/components/editor/libs/nodes/layout-item-node'

export const nodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
  HeadingNode,
  ParagraphNode,
  TextNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  OverflowNode,
  HashtagNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  CodeNode,
  CodeHighlightNode,
  HorizontalRuleNode,
  ImageNode,
  EmojiNode,
  KeywordNode,
  LayoutContainerNode,
  LayoutItemNode,
  AutoLinkNode,
  AutocompleteNode,
]
