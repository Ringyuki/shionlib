import {
  Controller,
  Patch,
  Body,
  ParseIntPipe,
  Param,
  Req,
  UseGuards,
  Put,
  Delete,
  Post,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { GameEditService } from '../services/game-edit.service'
import { GameFieldSyncService } from '../services/game-field-sync.service'
import {
  EditGameReqDto,
  RemoveGameLinkReqDto,
  AddGameLinkReqDto,
  EditGameLinkReqDto,
  EditGameCoverReqDto,
  AddGameCoverReqDto,
  RemoveGameCoverReqDto,
  EditGameCoverDto,
  EditGameImageReqDto,
  AddGameImageReqDto,
  RemoveGameImageReqDto,
  EditGameImageDto,
  AddGameDeveloperReqDto,
  RemoveGameDeveloperReqDto,
  EditGameDeveloperReqDto,
  AddGameCharacterReqDto,
  RemoveGameCharacterReqDto,
  EditGameCharacterReqDto,
  AddGameRelationReqDto,
  RemoveGameRelationReqDto,
  EditGameRelationsReqDto,
  ApplyGameFieldSyncReqDto,
  ApplyGameScalarSyncReqDto,
  GameScalarSyncFieldEnum,
  PreviewGameScalarSyncReqDto,
} from '../dto/req/edit-game.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EditAuthGuard } from '../../edit/guards/edit-auth.guard'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { gameRequiredBits, GamekeyToBit } from '../../edit/resolvers/permisson-resolver'
import { GameFieldGroupBit } from '../../edit/enums/field-group.enum'

const ScalarSyncFieldToBit: Record<GameScalarSyncFieldEnum, GameFieldGroupBit> = {
  [GameScalarSyncFieldEnum.TITLES]: GameFieldGroupBit.TITLES,
  [GameScalarSyncFieldEnum.ALIASES]: GameFieldGroupBit.ALIASES,
  [GameScalarSyncFieldEnum.INTROS]: GameFieldGroupBit.INTROS,
  [GameScalarSyncFieldEnum.RELEASE]: GameFieldGroupBit.RELEASE,
  [GameScalarSyncFieldEnum.TYPE]: GameFieldGroupBit.TYPE,
  [GameScalarSyncFieldEnum.PLATFORMS]: GameFieldGroupBit.PLATFORMS,
  [GameScalarSyncFieldEnum.EXTRA]: GameFieldGroupBit.EXTRA,
  [GameScalarSyncFieldEnum.STAFFS]: GameFieldGroupBit.STAFFS,
  [GameScalarSyncFieldEnum.TAGS]: GameFieldGroupBit.TAGS,
}

const scalarSyncRequiredBits = (dto: { field?: GameScalarSyncFieldEnum }) => {
  const bit = dto?.field ? ScalarSyncFieldToBit[dto.field] : undefined
  return bit === undefined ? [] : [bit]
}

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameEditController {
  constructor(
    private readonly gameEditService: GameEditService,
    private readonly gameFieldSyncService: GameFieldSyncService,
  ) {}

  @UseGuards(EditAuthGuard(PermissionEntity.GAME, gameRequiredBits, GamekeyToBit))
  @Patch(':id/edit/scalar')
  async editGameScalar(
    @Body() dto: EditGameReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editGameScalar(id, dto, req)
  }

  @UseGuards(EditAuthGuard(PermissionEntity.GAME, scalarSyncRequiredBits, undefined, 'scalar'))
  @Post(':id/edit/scalar/sync/preview')
  async previewScalarSync(
    @Body() dto: PreviewGameScalarSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.gameFieldSyncService.previewScalar(id, dto.field)
  }

  @UseGuards(EditAuthGuard(PermissionEntity.GAME, scalarSyncRequiredBits, undefined, 'scalar'))
  @Post(':id/edit/scalar/sync/apply')
  async applyScalarSync(
    @Body() dto: ApplyGameScalarSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.applyScalar(id, dto.field, dto.candidateIds, req, dto.note)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_LINKS],
      undefined,
      'links',
    ),
  )
  @Patch(':id/edit/links')
  async editLinks(
    @Body() dto: EditGameLinkReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editLinks(id, dto.links, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_LINKS],
      undefined,
      'links',
    ),
  )
  @Put(':id/edit/links')
  async addLinks(
    @Body() dto: AddGameLinkReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addLinks(id, dto.links, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_LINKS],
      undefined,
      'links',
    ),
  )
  @Delete(':id/edit/links')
  async removeLinks(
    @Body() dto: RemoveGameLinkReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeLinks(id, dto.ids, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Patch(':id/edit/covers')
  async editCovers(
    @Body() dto: EditGameCoverReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editCovers(id, dto.covers, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Patch(':id/edit/cover')
  async editCover(
    @Body() dto: EditGameCoverDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editCover(id, dto, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Put(':id/edit/covers')
  async addCovers(
    @Body() dto: AddGameCoverReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addCovers(id, dto.covers, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Delete(':id/edit/covers')
  async removeCovers(
    @Body() dto: RemoveGameCoverReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeCovers(id, dto.ids, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Patch(':id/edit/images')
  async editImages(
    @Body() dto: EditGameImageReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editImages(id, dto.images, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Patch(':id/edit/image')
  async editImage(
    @Body() dto: EditGameImageDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editImage(id, dto, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Put(':id/edit/images')
  async addImages(
    @Body() dto: AddGameImageReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addImages(id, dto.images, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Delete(':id/edit/images')
  async removeImages(
    @Body() dto: RemoveGameImageReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeImages(id, dto.ids, req)
  }

  // Developer relation endpoints
  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_DEVELOPERS],
      undefined,
      'developers',
    ),
  )
  @Put(':id/edit/developers')
  async addDevelopers(
    @Body() dto: AddGameDeveloperReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addDevelopers(id, dto.developers, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_DEVELOPERS],
      undefined,
      'developers',
    ),
  )
  @Delete(':id/edit/developers')
  async removeDevelopers(
    @Body() dto: RemoveGameDeveloperReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeDevelopers(id, dto.ids, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_DEVELOPERS],
      undefined,
      'developers',
    ),
  )
  @Patch(':id/edit/developers')
  async editDevelopers(
    @Body() dto: EditGameDeveloperReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editDevelopers(id, dto.developers, req)
  }

  // Character relation endpoints
  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_CHARACTERS],
      undefined,
      'characters',
    ),
  )
  @Put(':id/edit/characters')
  async addCharacters(
    @Body() dto: AddGameCharacterReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addCharacters(id, dto.characters, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_CHARACTERS],
      undefined,
      'characters',
    ),
  )
  @Delete(':id/edit/characters')
  async removeCharacters(
    @Body() dto: RemoveGameCharacterReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeCharacters(id, dto.ids, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_CHARACTERS],
      undefined,
      'characters',
    ),
  )
  @Patch(':id/edit/characters')
  async editCharacters(
    @Body() dto: EditGameCharacterReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editCharacters(id, dto.characters, req)
  }

  // Game relation endpoints
  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Put(':id/edit/relations')
  async addGameRelations(
    @Body() dto: AddGameRelationReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.addGameRelations(id, dto.relations, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Delete(':id/edit/relations')
  async removeGameRelations(
    @Body() dto: RemoveGameRelationReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.removeGameRelations(id, dto.ids, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Patch(':id/edit/relations')
  async editGameRelations(
    @Body() dto: EditGameRelationsReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.editGameRelations(id, dto.relations, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_LINKS],
      undefined,
      'links',
    ),
  )
  @Post(':id/edit/links/sync/preview')
  async previewLinkSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'links')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_LINKS],
      undefined,
      'links',
    ),
  )
  @Post(':id/edit/links/sync/apply')
  async applyLinkSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'links', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Post(':id/edit/covers/sync/preview')
  async previewCoverSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'covers')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_COVERS],
      undefined,
      'covers',
    ),
  )
  @Post(':id/edit/covers/sync/apply')
  async applyCoverSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'covers', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Post(':id/edit/images/sync/preview')
  async previewImageSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'images')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_IMAGES],
      undefined,
      'images',
    ),
  )
  @Post(':id/edit/images/sync/apply')
  async applyImageSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'images', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_DEVELOPERS],
      undefined,
      'developers',
    ),
  )
  @Post(':id/edit/developers/sync/preview')
  async previewDeveloperSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'developers')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_DEVELOPERS],
      undefined,
      'developers',
    ),
  )
  @Post(':id/edit/developers/sync/apply')
  async applyDeveloperSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'developers', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_CHARACTERS],
      undefined,
      'characters',
    ),
  )
  @Post(':id/edit/characters/sync/preview')
  async previewCharacterSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'characters')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_CHARACTERS],
      undefined,
      'characters',
    ),
  )
  @Post(':id/edit/characters/sync/apply')
  async applyCharacterSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'characters', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Post(':id/edit/relations/sync/preview')
  async previewRelationSync(@Param('id', ParseIntPipe) id: number) {
    return this.gameFieldSyncService.preview(id, 'relations')
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Post(':id/edit/relations/sync/apply')
  async applyRelationSync(
    @Body() dto: ApplyGameFieldSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameFieldSyncService.apply(id, 'relations', dto.candidateIds, req)
  }

  @UseGuards(
    EditAuthGuard(
      PermissionEntity.GAME,
      () => [GameFieldGroupBit.MANAGE_RELATIONS],
      undefined,
      'relations',
    ),
  )
  @Post(':id/edit/relations/sync-from-bangumi')
  async syncRelationsFromBangumi(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.gameEditService.syncRelationsFromBangumi(id, req)
  }
}
