# ADR 0001: Rewrite the backend in Go with capability packages and explicit wiring

## Context
The NestJS backend relies on decorators, a DI container and module boundaries that are not enforced. A large share of future changes will be written by agents, so structure must be predictable and machine-checked.

## Decision
- Go module `apps/api` with layers kernel → business capabilities → adapters / transport / platform → bootstrap → cmd, enforced by `internal/archtest` and depguard.
- Explicit constructor injection in `internal/bootstrap`; no DI container or service locator.
- Ports are declared by consumers. Adapters translate infrastructure errors.
- The code base carries no comments; intent lives in names, tests and these documents.
- New third-party dependencies require: the standard library cannot reasonably do it, no existing dependency covers it, it is maintained and stable, its dependency tree and runtime behavior are acceptable.

## Alternatives
Porting the NestJS module structure one-to-one (rejected: reproduces implicit wiring); Uber fx/dig (rejected: runtime reflection hides the graph); google/wire (deferred: wiring is still small enough to read).

## Consequences
More boilerplate in exchange for searchable, uniform modules. Architectural drift fails CI.

## Migration
Capabilities are ported one by one behind the unchanged HTTP contract.
