import { cn, Prose } from '@hina-ui/react'
import type { ReactNode } from 'react'
import {
  headingLevel,
  pictureOf,
  sectionId,
  type NodeKind,
  type RichDocument,
  type RichNode,
} from '~/shared/richtext/rich-text'
import { PictureFigure } from './picture-figure'
import { RichInline } from './rich-text-inline'
import { RichTable } from './rich-text-table'

type Anchors = ReadonlyMap<RichNode, string>

const unanchored: Anchors = new Map()

type RichTextProps = {
  document: RichDocument
  anchored?: boolean
  lead?: ReactNode
  className?: string
}

export function RichText({ document, anchored = false, lead, className }: RichTextProps) {
  const headings = document.content.filter(node => node.type === 'heading')
  const anchors = anchored
    ? new Map(headings.map((node, index) => [node, sectionId(index)]))
    : unanchored
  const leads = lead !== undefined && document.content[0]?.type === 'paragraph'
  return (
    <Prose className={cn('rich-text', className)}>
      {lead !== undefined && !leads && <p>{lead}</p>}
      <Blocks nodes={document.content} anchors={anchors} lead={leads ? lead : undefined} />
    </Prose>
  )
}

type BlocksProps = { nodes: readonly RichNode[]; anchors: Anchors; lead?: ReactNode }

function Blocks({ nodes, anchors, lead }: BlocksProps) {
  return nodes.map((node, index) => (
    <Block key={index} node={node} anchors={anchors} lead={index === 0 ? lead : undefined} />
  ))
}

function unknownNode(kind: never): null {
  void kind
  return null
}

type BlockProps = { node: RichNode; anchors: Anchors; lead?: ReactNode }

function Block({ node, anchors, lead }: BlockProps) {
  const kind: NodeKind = node.type
  const children = node.content ?? []
  switch (kind) {
    case 'paragraph':
      return (
        <p>
          {lead}
          {children.length === 0 && lead === undefined ? <br /> : <RichInline nodes={children} />}
        </p>
      )
    case 'heading': {
      const Title = headingLevel(node) === 2 ? 'h2' : 'h3'
      return (
        <Title id={anchors.get(node)} className="scroll-mt-20">
          <RichInline nodes={children} />
        </Title>
      )
    }
    case 'blockquote':
      return (
        <blockquote>
          <Blocks nodes={children} anchors={anchors} />
        </blockquote>
      )
    case 'bullet_list':
      return (
        <ul>
          <Blocks nodes={children} anchors={anchors} />
        </ul>
      )
    case 'ordered_list':
      return (
        <ol>
          <Blocks nodes={children} anchors={anchors} />
        </ol>
      )
    case 'list_item':
      return (
        <li>
          <Blocks nodes={children} anchors={anchors} />
        </li>
      )
    case 'horizontal_rule':
      return <hr />
    case 'image_block':
      return <PictureFigure picture={pictureOf(node)} zoomable />
    case 'table':
      return (
        <RichTable node={node} renderCell={nodes => <Blocks nodes={nodes} anchors={anchors} />} />
      )
    case 'table_row':
    case 'table_header':
    case 'table_cell':
      return null
    case 'hard_break':
    case 'text':
      return <RichInline nodes={[node]} />
    default:
      return unknownNode(kind)
  }
}
