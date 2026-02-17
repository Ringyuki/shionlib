import { TextMatchTransformer } from '@lexical/markdown'

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from '@/components/editor/libs/nodes/image-node'

export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: node => {
    if (!$isImageNode(node)) {
      return null
    }

    return `![${node.getAltText()}](${node.getSrc()})`
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match
    const imageNode = $createImageNode({
      altText,
      maxWidth: 800,
      src,
      captionsEnabled: false,
    })
    textNode.replace(imageNode)
  },
  trigger: ')',
  type: 'text-match',
}
