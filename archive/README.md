# archive

一次性数据归档，不参与任何运行时逻辑。

## shionlib-cover-labels-2026-08-19.csv.gz

shionlib 自有 galgame 数据退役前，对 `game_covers` 语言标注的完整导出（12105 行）。

条目数据改为从 hikarinagi 读透后本表会被删除，而 hikarinagi 侧封面无来源字段、两边封面无法按身份匹配，标注因此无法迁移。此文件仅为保留将来的可能性：`url` 是 shionlib 对象存储 key，对象仍在，配合感知哈希可再尝试匹配。

列：`hikarinagi_galgame_id`(11591 行非空)、`shionlib_game_id`、`language`(jp 10269 / en 1366 / zh 470)、`type`、`sexual`、`violence`、`source`、`source_key`、`source_url`(108 行非空,均来自 vndb)、`url`、`dims`。
