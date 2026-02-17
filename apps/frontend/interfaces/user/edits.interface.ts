type EditActionType =
  | 'UPDATE_SCALAR'
  | 'ADD_RELATION'
  | 'REMOVE_RELATION'
  | 'SET_RELATION'
  | 'UPDATE_RELATION'

type EditRelationType = 'cover' | 'image' | 'link' | 'developer' | 'character'

export interface GameEntityInfo {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
}

export interface CharacterEntityInfo {
  id: number
  name_jp: string
  name_zh: string | null
  name_en: string | null
}

export interface DeveloperEntityInfo {
  id: number
  name: string
  aliases: string[]
}

interface Actor {
  id: number
  name: string
  avatar: string
}

interface EditRecordBase {
  id: number
  entity: 'game' | 'character' | 'developer'
  target_id: number
  action: EditActionType
  field_changes: string[]
  changes: any
  relation_type: EditRelationType | null
  entity_info: GameEntityInfo | CharacterEntityInfo | DeveloperEntityInfo | null
  actor: Actor | null
  note: string | null
  created: string
  updated: string

  undo: boolean
  undo_of: {
    id: number
  }
  undone_by: {
    id: number
  }
}

interface GameEditRecord extends EditRecordBase {
  entity: 'game'
  entity_info: GameEntityInfo
}

interface CharacterEditRecord extends EditRecordBase {
  entity: 'character'
  entity_info: CharacterEntityInfo
}

interface DeveloperEditRecord extends EditRecordBase {
  entity: 'developer'
  entity_info: DeveloperEntityInfo
}

export type EditRecordItem = GameEditRecord | CharacterEditRecord | DeveloperEditRecord
