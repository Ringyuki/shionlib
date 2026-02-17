export class CharacterRelationResDto {
  role: Role
  actor: string
  image: string
}

enum Role {
  MAIN = 'main',
  PRIMARY = 'primary',
  SIDE = 'side',
  APPEARS = 'appears',
}
