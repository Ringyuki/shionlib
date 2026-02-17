export class PermissionsResDto {
  allowMask: string
  fields: Record<string, boolean>
  scalarFields: string[]
  relationFields: string[]
}
