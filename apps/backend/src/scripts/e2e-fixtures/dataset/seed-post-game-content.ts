import { ActivityType, Prisma, PrismaClient } from '@prisma/client'
import {
  seeded_comments,
  seeded_favorite_item_note,
  seeded_malware_file,
  seeded_malware_resource,
  seeded_malware_scan_case,
  seeded_reportable_resource,
  seeded_reportable_resource_file,
} from './content'

interface SeedPostGameContentParams {
  prisma: PrismaClient
  makeCommentContent: (text: string) => Prisma.InputJsonValue
  adminId: number
  memberId: number
  memberFavorites: { id: number; default: boolean }[]
  mutableMemberId: number
  primaryGameId: number
  malwareGameId: number
  createdGameIds: number[]
}

export const seedPostGameContent = async ({
  prisma,
  makeCommentContent,
  adminId,
  memberId,
  memberFavorites,
  mutableMemberId,
  primaryGameId,
  malwareGameId,
  createdGameIds,
}: SeedPostGameContentParams): Promise<void> => {
  const rootComment = await prisma.comment.create({
    data: {
      content: makeCommentContent(seeded_comments.root.text),
      html: seeded_comments.root.html,
      game_id: primaryGameId,
      creator_id: memberId,
      status: 1,
    },
    select: {
      id: true,
    },
  })

  await prisma.comment.create({
    data: {
      content: makeCommentContent(seeded_comments.reply.text),
      html: seeded_comments.reply.html,
      game_id: primaryGameId,
      creator_id: adminId,
      parent_id: rootComment.id,
      root_id: rootComment.id,
      status: 1,
    },
  })

  await prisma.comment.update({
    where: {
      id: rootComment.id,
    },
    data: {
      reply_count: 1,
    },
  })

  await prisma.activity.createMany({
    data: [
      {
        type: ActivityType.GAME_CREATE,
        user_id: adminId,
        game_id: createdGameIds[0],
      },
      {
        type: ActivityType.GAME_CREATE,
        user_id: adminId,
        game_id: createdGameIds[1] ?? createdGameIds[0],
      },
      {
        type: ActivityType.COMMENT,
        user_id: memberId,
        game_id: primaryGameId,
        comment_id: rootComment.id,
      },
    ],
  })

  const memberDefaultFavorite = memberFavorites.find(item => item.default)
  if (memberDefaultFavorite) {
    await prisma.favoriteItem.create({
      data: {
        favorite_id: memberDefaultFavorite.id,
        game_id: primaryGameId,
        note: seeded_favorite_item_note,
      },
    })
  }

  const seededReportableResource = await prisma.gameDownloadResource.create({
    data: {
      game_id: primaryGameId,
      creator_id: mutableMemberId,
      platform: [...seeded_reportable_resource.platform],
      language: [...seeded_reportable_resource.language],
      note: seeded_reportable_resource.note,
    },
    select: {
      id: true,
    },
  })

  await prisma.gameDownloadResourceFile.create({
    data: {
      ...seeded_reportable_resource_file,
      game_download_resource_id: seededReportableResource.id,
      creator_id: mutableMemberId,
    },
  })

  const seededMalwareResource = await prisma.gameDownloadResource.create({
    data: {
      game_id: malwareGameId,
      creator_id: adminId,
      platform: [...seeded_malware_resource.platform],
      language: [...seeded_malware_resource.language],
      note: seeded_malware_resource.note,
    },
    select: {
      id: true,
    },
  })

  const seededMalwareFile = await prisma.gameDownloadResourceFile.create({
    data: {
      ...seeded_malware_file,
      game_download_resource_id: seededMalwareResource.id,
      creator_id: adminId,
    },
    select: {
      id: true,
      file_name: true,
      file_size: true,
      file_hash: true,
      hash_algorithm: true,
    },
  })

  await prisma.malwareScanCase.create({
    data: {
      file_id: seededMalwareFile.id,
      resource_id: seededMalwareResource.id,
      game_id: malwareGameId,
      uploader_id: adminId,
      review_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      detector: seeded_malware_scan_case.detector,
      detected_viruses: [...seeded_malware_scan_case.detected_viruses],
      scan_result: seeded_malware_scan_case.scan_result as Prisma.InputJsonValue,
      scan_log_path: seeded_malware_scan_case.scan_log_path,
      scan_log_excerpt: seeded_malware_scan_case.scan_log_excerpt,
      file_name: seededMalwareFile.file_name,
      file_size: seededMalwareFile.file_size,
      hash_algorithm: seededMalwareFile.hash_algorithm,
      file_hash: seededMalwareFile.file_hash,
      notify_uploader_on_allow: seeded_malware_scan_case.notify_uploader_on_allow,
    },
  })
}
