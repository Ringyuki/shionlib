# Glossary

| Term | Meaning |
|---|---|
| Capability | A business package under `internal/<name>` that owns one area of behavior (favorite, game, auth). |
| Service | The capability's entry type (`favorite.Service`) holding business rules and transaction boundaries. |
| Port | An interface declared by a consumer in its `ports.go` describing what it needs (`Repository`, `GameCards`, `Transactor`, `Queue`). |
| Adapter | An implementation of a port backed by infrastructure (`favoritepg.Repository`, `authredis.FamilyBlocklist`). |
| Repository | A port and its adapter for persisting a capability's own data. |
| Store | A read-model adapter that serves data owned elsewhere (`gamepg.CardStore`). |
| Handler | An HTTP transport type (`favoritehttp.Handler`) that registers routes and calls a service. |
| Worker | A River job processor in `internal/transport/jobs` that calls a service. |
| Task | A scheduled, leader-elected periodic job (`jobs.Task`). |
| Actor | The authenticated caller (`actor.Actor`), or the guest actor with `UserID == 0`. |
| Content limit | The viewer's NSFW preference: 0 guest, 1 never show, 2 show with spoiler, 3 just show. "Includes rated" means 2 or 3. |
| Catalog source | A pluggable provider of game, developer and character metadata (Hikarinagi Open API by default). |
| Contract test | A test suite that every implementation of a port must pass. |
