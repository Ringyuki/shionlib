export interface ScalarChanges {
  before: Record<string, unknown>
  after: Record<string, unknown>
}
export interface RelationChanges {
  relation: 'links' | 'covers' | 'images' | 'developers' | 'characters'
  before?: any[]
  after?: any[]
  added?: any[]
  removed?: any[]
}
