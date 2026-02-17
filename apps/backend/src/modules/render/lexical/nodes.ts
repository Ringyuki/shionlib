import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { HashtagNode } from '@lexical/hashtag'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { OverflowNode } from '@lexical/overflow'
import { HorizontalRuleNode } from '@lexical/extension'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { Klass, LexicalNode, LexicalNodeReplacement, ParagraphNode, TextNode } from 'lexical'

export const serverNodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
  HeadingNode,
  ParagraphNode,
  TextNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  HashtagNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  CodeNode,
  CodeHighlightNode,
  HorizontalRuleNode,
  OverflowNode,
  AutoLinkNode,
]
