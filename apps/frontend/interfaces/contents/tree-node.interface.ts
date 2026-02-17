export interface TreeNode {
  name: string
  label: string
  path: string
  children?: TreeNode[]
  type: 'file' | 'directory'
}
