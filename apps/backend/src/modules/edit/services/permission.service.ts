import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { createFieldPermissionMap } from '../helpers/field-mapper'
import { PermissionsResDto } from '../dto/res/permissons.res.dto'

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllowMaskFor(user_id: number, role: number, entity: PermissionEntity): Promise<bigint> {
    const [rolePerm, userPerm] = await Promise.all([
      this.prisma.roleFieldPermission.findUnique({ where: { role_entity: { role, entity } } }),
      this.prisma.userFieldPermission.findUnique({
        where: { user_id_entity: { user_id, entity } },
      }),
    ])
    const roleMask = BigInt(rolePerm?.allowMask ?? 0)
    const userMask = BigInt(userPerm?.allowMask ?? 0)
    return roleMask | userMask
  }

  ensureHasBits(allowMask: bigint, ...bits: number[]) {
    for (const b of bits) if (!((allowMask & (1n << BigInt(b))) !== 0n)) return false
    return true
  }

  async getPermissionDetails(
    user_id: number,
    role: number,
    entity: PermissionEntity,
  ): Promise<PermissionsResDto> {
    const allowMask = await this.getAllowMaskFor(user_id, role, entity)

    const mappings = await this.prisma.fieldPermissionMapping.findMany({
      where: { entity },
      orderBy: { bitIndex: 'asc' },
    })

    const fieldGroups: Record<string, boolean> = {}
    const scalarFields: string[] = []
    const relationFields: string[] = []

    for (const mapping of mappings) {
      const hasPermission = (allowMask & (1n << BigInt(mapping.bitIndex))) !== 0n
      fieldGroups[mapping.field] = hasPermission
      if (hasPermission) {
        if (mapping.isRelation) {
          relationFields.push(mapping.field)
        } else {
          scalarFields.push(mapping.field)
        }
      }
    }

    const fields = createFieldPermissionMap(fieldGroups, entity)
    return {
      allowMask: allowMask.toString(),
      fields,
      scalarFields,
      relationFields,
    }
  }

  hasBit(allowMask: bigint, bit: number): boolean {
    return (allowMask & (1n << BigInt(bit))) !== 0n
  }
}
