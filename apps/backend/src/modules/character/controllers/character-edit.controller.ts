import { Controller, Patch, Param, Body, ParseIntPipe, UseGuards, Req } from '@nestjs/common'
import { CharacterEditService } from '../services/character-edit.service'
import { EditCharacterReqDto } from '../dto/req/edit-character.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { EditAuthGuard } from '../../edit/guards/edit-auth.guard'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { characterRequiredBits, CharacterKeyToBit } from '../../edit/resolvers/permisson-resolver'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Controller('character')
export class CharacterEditController {
  constructor(private readonly characterEditService: CharacterEditService) {}

  @UseGuards(JwtAuthGuard)
  @UseGuards(EditAuthGuard(PermissionEntity.CHARACTER, characterRequiredBits, CharacterKeyToBit))
  @Patch(':id/edit/scalar')
  async editCharacterScalar(
    @Body() dto: EditCharacterReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.characterEditService.editCharacterScalar(id, dto, req)
  }
}
