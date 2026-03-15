import { GameRelationType } from '@prisma/client'

export const REVERSE_RELATION_MAP: Record<GameRelationType, GameRelationType> = {
  SEQUEL: GameRelationType.PREQUEL,
  PREQUEL: GameRelationType.SEQUEL,
  SIDE_STORY: GameRelationType.MAIN_STORY,
  MAIN_STORY: GameRelationType.SIDE_STORY,
  VARIANT: GameRelationType.MAIN_VERSION,
  MAIN_VERSION: GameRelationType.VARIANT,
  COLLECTION: GameRelationType.COLLECTED_WORK,
  COLLECTED_WORK: GameRelationType.COLLECTION,
  SAME_UNIVERSE: GameRelationType.SAME_UNIVERSE,
  DIFFERENT_ADAPTATION: GameRelationType.DIFFERENT_ADAPTATION,
  EXPANSION: GameRelationType.EXPANSION,
}

export const BANGUMI_RELATION_MAP: Record<string, GameRelationType> = {
  续集: GameRelationType.SEQUEL,
  前传: GameRelationType.PREQUEL,
  外传: GameRelationType.SIDE_STORY,
  主线故事: GameRelationType.MAIN_STORY,
  不同演绎: GameRelationType.DIFFERENT_ADAPTATION,
  相同世界观: GameRelationType.SAME_UNIVERSE,
  不同版本: GameRelationType.VARIANT,
  主版本: GameRelationType.MAIN_VERSION,
  合集: GameRelationType.COLLECTION,
  收录作品: GameRelationType.COLLECTED_WORK,
  扩展包: GameRelationType.EXPANSION,
}
