import { Spoiler } from '@hina-ui/react'
import { hasMark, inlineRuns, linkOf, type RichNode } from '~/shared/richtext/rich-text'

export function RichInline({ nodes }: { nodes: readonly RichNode[] }) {
  const hidden = (node: RichNode) => (hasMark(node.marks, 'spoiler') ? 'spoiler' : undefined)
  return inlineRuns(nodes, hidden).map((run, index) =>
    run.key === undefined ? (
      <Linked key={index} nodes={run.nodes} />
    ) : (
      <Spoiler key={index}>
        <Linked nodes={run.nodes} />
      </Spoiler>
    ),
  )
}

function Linked({ nodes }: { nodes: readonly RichNode[] }) {
  return inlineRuns(nodes, node => linkOf(node.marks)).map((run, index) =>
    run.key === undefined ? (
      <Leaves key={index} nodes={run.nodes} />
    ) : (
      <a key={index} href={run.key} target="_blank" rel="noopener noreferrer nofollow ugc">
        <Leaves nodes={run.nodes} />
      </a>
    ),
  )
}

function Leaves({ nodes }: { nodes: readonly RichNode[] }) {
  return nodes.map((node, index) => <Leaf key={index} node={node} />)
}

function Leaf({ node }: { node: RichNode }) {
  if (node.type === 'hard_break') {
    return <br />
  }
  return hasMark(node.marks, 'bold') ? <strong>{node.text}</strong> : node.text
}
