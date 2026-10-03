# ADR 0006: Pluggable catalog sources with local materialization

## Context
Game, developer and character metadata were read at request time from Hikarinagi's internal API using a shared secret, and Hikarinagi pulled download data from Shionlib's partner API with the same secret. Lists, search and details failed whenever the internal API was unavailable. The public Hikarinagi Open API exposes details and search but no listing or change feed.

## Decision
- Catalog metadata is stored in Shionlib's own tables (games, covers, images, tags, developers, characters, relations, links). Every read path uses local data.
- A `catalog.Source` port describes what a provider supplies (fetch game/developer/character snapshots, search). Optional capabilities (change feed) are separate interfaces. The official adapter uses the Hikarinagi Open API with an OAuth client-credentials token (`catalog:read catalog:full`).
- Hikarinagi will expose an Open API change feed; until then refresh is pull-based by age.
- Source identities are stored per entity and source, so additional sources can be added without schema changes.
- The internal client, the changes cursor table and the partner API are removed.

## Consequences
Shionlib owns availability of its catalog. Imports and refreshes are background jobs bounded by the source's rate limit. Initial backfill fetches every referenced work once.
