# Glossary

One word per concept. `internal/archtest` rejects the banned words below; reviewers reject the rest.

## Architecture

| Term | Meaning | Example |
|---|---|---|
| Capability | A business package `internal/<name>` that owns one area of behavior: models, rules, ports, errors, job args. | `internal/favorite` |
| Service | The type that holds a capability's business rules and transaction boundaries. `Service` for the main one, `<Purpose>Service` for a focused one. Anything built from injected ports is a service. | `favorite.Service`, `auth.CodeService` |
| Port | An interface declared by the consumer in its `ports.go`, listing only the methods it calls. | `favorite.Repository`, `auth.VerificationCodeStore` |
| Adapter | An implementation of a port backed by infrastructure, in `internal/adapter/*`. | `favoritepg.Repository`, `authredis.Store` |
| Repository | The port and Postgres adapter that persist a capability's own data. | `commentpg.Repository` |
| Store | An adapter for a read model, for data owned by another capability, or for non-relational state. | `gamepg.CardStore`, `authredis.Store` |
| Record | An unexported adapter struct that is the storage shape of a model (JSON in Redis, jsonb columns). Business models never double as records. | `authredis.verificationCodeRecord` |
| Client | An adapter that calls a third-party HTTP API. | `vndb.Client`, `hikarinagi.Client` |
| Source | An adapter that supplies catalog data (games, developers, characters) through `catalog.Source`. | `hikarinagi.Source` |
| Handler | The HTTP transport type that registers routes and calls one service method per route. `<Purpose>Handler` for a focused one. | `favoritehttp.Handler`, `adminhttp.StatsHandler` |
| Input | An HTTP request struct (path, query, header, cookie params and `Body`) in `request*.go`. | `createFavoriteInput` |
| DTO | An HTTP response struct in `response*.go`, snake_case JSON. | `favoriteDTO` |
| Worker | A River job processor in `internal/transport/jobs/<capability>jobs` that calls one service method. | `downloadjobs.StoreWorker` |
| Job | The args of a queued unit of work, declared in the capability's `jobs.go` with `Kind()`. | `download.StoreFile` |
| Task | A scheduled, leader-elected periodic job (`jobs.Task`) declared in `tasks.go`. | `game.refresh_hot_score` |
| Queue | The port business code enqueues jobs through; implemented by `internal/adapter/queue`. | `report.Queue` |
| Notifier | A port that pushes realtime events to connected users; implemented by `internal/adapter/push`. | `message.Notifier` |
| Deps | A struct bundling a service's or handler's injected dependencies when the constructor would take too many. | `catalog.Deps` |
| Options | Constructor values fixed for the life of the process (URLs, modes, client timeouts). Values an operator tunes are settings instead. | `download.LinkOptions`, `httpclient.Options` |
| Policy | Business rule parameters that decide what is allowed and are fixed at startup. | `auth.SessionPolicy` |
| Setting | A tunable value declared with `setting.Int/Bytes/Float/Duration/Flag/Text` in the owning package's `settings.go`, changed from the admin panel and read where it is used with `Key.Read(source)`. | `upload.MaxFileSize` |
| Source | `setting.Source`, the one interface every package reads settings through: `*setting.Service` in production, `settingtest.Source` in tests. | |
| Announcer | A port that tells the other processes a shared snapshot changed so they reload it; implemented by `platform/refresh.Watcher`. | `setting.Announcer` |
| Contract test | A suite in `<capability>test/contract.go` that every implementation of a port passes (memory fake and real adapter). | `favoritetest.RepositoryContract` |
| Fake | An in-memory implementation of a port in `<capability>test`, used instead of mocks. | `favoritetest.MemoryRepository` |
| Golden path | `internal/favorite` with `favoritepg` and `favoritehttp`: the reference implementation to copy. | |

## Business vocabulary

| Term | Meaning |
|---|---|
| `New<Thing>` | the data needed to create a thing (`message.NewMessage`) |
| `<Thing>Changes` | a partial update; nil fields are untouched (`favorite.Changes`) |
| `<Action>Input` | the parameters of one service command (`favorite.CreateInput`) |
| `<Thing>Filter`, `Page` | list criteria and paging; every capability's `Page` is an alias of `paging.Page` (`comment.AdminFilter`, `comment.Page`) |
| `patch.Clearable[T]` | an update field that is untouched (`Set == false`), cleared (`Set` with nil `Value`) or set |
| `Entry`, `Summary`, `View`, `Detail` | read models from smallest to largest (`walkthrough.AdminEntry`, `walkthrough.AdminDetail`) |
| `Ref` | a reference to another entity with just enough fields to render a link (`game.DeveloperRef`) |
| `Meta` (`message.Meta`) | the free-form key/value document attached to a message; the web client reads its keys |
| Actor | The caller (`actor.Actor`); the guest actor has `UserID == 0`. |
| Content limit | The viewer's NSFW preference: 0 guest, 1 never show, 2 show with spoiler, 3 just show. "Includes rated" means 2 or 3. |
| Standing | What a user is right now: role and content limit (`auth.Standing`). It is read for every authenticated request and never taken from a token, so a change applies to the next request. |
| Catalog source | A pluggable provider of game, developer and character metadata (Hikarinagi Open API by default). |
| Canonical name | The file name the site writes for the first file of a resource from the game and the resource information (`download.CanonicalName`): `[发售日][品牌] 原名 译名 发行版本 [翻译][补丁版本] (形态).扩展名`. The medium in the last brackets is `inspection.Medium` for a disc image. The name a file was uploaded with stays in `original_name`. |
| Translator | Who made a fan translation: a group or a single person (汉化组 in the web client), `translator.Translator`. A resource credits its translators in order; names are matched by `translator.Key` (width, case and spacing ignored), so one translator is stored once however its name is typed. |
| Resource information | What a download resource says about itself besides platform and language: translation, translators, patch version, release page, edition, form and extras (`download.Info`). |
| Composition | Making a new resource from a stored one and an uploaded patch on the server (`composition.Composition`, ADR 0016): a draft, then queued, running, done or failed. The resource it was made from is never changed. |
| Form reading | Telling from an inspection whether a resource is a disc image, an installer or a folder that runs as it is (`scan.ReadForm`, ADR 0017). It fills a form nobody gave and records `form_read` in the history. |
| Undescribed | A resource published before structured information whose note and file names the worker has not read yet (`game_download_resources.undescribed`, ADR 0017). |
| Base | The stored resource a composition reads (`composition.Base`, 原版 in the web client): a published, checked, portable resource of the same game whose contents are known from its inspection. |
| Plan | What a patch does to a base, drawn from their listings before anything is unpacked (`composition.Plan`): the game folder, the patch folder, the files added and replaced and the conflicts. |
| AI provider | An upstream AI account configured in the admin panel: kind, base URL, API key, price multiplier (`ai.Provider`). |
| Payment provider | What takes the money for a sponsor order, behind the port `sponsor.Provider` (支付网关 in the admin panel). Each is an adapter known by a name that orders remember; iDataRiver is the only one. No vendor name, field or code leaves its adapter (ADR 0015). |
| Payment method brand | The vendor-neutral identity of a way to pay (`alipay`, `wechat_pay`, `paypal`, `google_pay`, `apple_pay`, `usdt`), assigned by a provider's adapter to the methods it recognises (`sponsor.MethodBrand`). |
| AI model | The site's name for a model and its capabilities, optionally linked to a models.dev catalog entry (`ai.Model`). |
| AI route | One way to reach a model: a provider, the upstream model id, protocol, price, priority and health status (`ai.Route`). |
| AI scene | A call site in code (`moderation_screen`, `moderation_review`) bound to a model in the admin panel (`ai.SceneDefinition`). |

## Banned words

`Manager`, `Processor`, `Usecase`/`UseCase`, `Interactor`, `Coordinator`, `Facade`, `Helper`, `Util`/`Utils`, `Impl`, `Controller` as type suffixes, and `util(s)`, `common`, `helper(s)`, `base`, `misc`, `shared`, `core`, `models`, `interfaces`, `types` as package names. Use the term from the table above instead (a "manager" or "use case" is a Service; a "controller" is a Handler; a "processor" is a Worker or an adapter named for its role, such as `imaging.Transcoder`). Do not introduce `Gateway` or `Consumer`: outbound adapters are Clients, inbound queue processors are Workers.
