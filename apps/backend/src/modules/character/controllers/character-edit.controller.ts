import { Controller, Patch, Param, Body, ParseIntPipe, UseGuards, Req, Post } from '@nestjs/common'
import { CharacterEditService } from '../services/character-edit.service'
import {
  ApplyCharacterScalarSyncReqDto,
  EditCharacterReqDto,
  PreviewCharacterScalarSyncBatchReqDto,
} from '../dto/req/edit-character.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { EditAuthGuard } from '../../edit/guards/edit-auth.guard'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import {
  characterRequiredBits,
  characterScalarSyncRequiredBits,
  CharacterKeyToBit,
} from '../../edit/resolvers/permisson-resolver'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { CharacterFieldSyncService } from '../services/character-field-sync.service'

@Controller('character')
export class CharacterEditController {
  constructor(
    private readonly characterEditService: CharacterEditService,
    private readonly characterFieldSyncService: CharacterFieldSyncService,
  ) {}

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

  @UseGuards(JwtAuthGuard)
  @UseGuards(
    EditAuthGuard(PermissionEntity.CHARACTER, characterScalarSyncRequiredBits, undefined, 'scalar'),
  )
  @Post(':id/edit/sync/preview')
  async previewFieldSyncBatch(
    @Body() dto: PreviewCharacterScalarSyncBatchReqDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.characterFieldSyncService.previewBatch(id, dto.fields)
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(
    EditAuthGuard(PermissionEntity.CHARACTER, characterScalarSyncRequiredBits, undefined, 'scalar'),
  )
  @Post(':id/edit/scalar/sync/apply')
  async applyScalarSync(
    @Body() dto: ApplyCharacterScalarSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.characterFieldSyncService.apply(id, dto.field, dto.candidateIds, req, dto.note)
  }
}
