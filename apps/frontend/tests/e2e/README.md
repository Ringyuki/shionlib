# E2E Blockers (Temporary)

Last updated: 2026-02-20

This file records E2E cases that are currently **not suitable to finish now** and what is needed to unblock them.

## 1. Legacy frontend OG routes

- Status: resolved
- Note: frontend no longer serves `/og` or `/og/to-png`; OG image generation moved to the standalone `apps/og` service.
- E2E now asserts legacy frontend OG routes return `404`.

## 2. Register full flow / Forget-password full flow

- Status: blocked
- Reason: end-to-end mail delivery is not configured in current environment.
- Unblock condition:
  - configure email provider envs (`EMAIL_PROVIDER`, endpoint, api key, sender)
  - provide a deterministic test mailbox/inbox capture strategy

## 3. Create game from external source (Bangumi / VNDB)

- Status: blocked
- Reason: Bangumi OAuth token file is not configured.
- Unblock condition:
  - provide `config/bangumi-tokens.json` (or equivalent secure token injection)
  - ensure external API access is available in CI/runtime

## 4. Favorites reorder

- Status: blocked
- Reason: backend reorder field/endpoint is not implemented yet.
- Unblock condition: implement backend reorder capability, then add E2E for drag/reorder persistence.

## 5. Small file upload flows (cover/image/developer logo/character image)

- Status: blocked
- Reason: object storage credentials/endpoint are not configured.
- Unblock condition:
  - configure object storage (S3/compatible) envs and bucket
  - ensure deterministic test cleanup for uploaded files

## 6. Download redirect with turnstile validation

- Status: blocked
- Reason: turnstile secret is not configured for deterministic E2E.
- Unblock condition:
  - configure `cloudflare.turnstile.secret`
  - provide test-mode token strategy or mock verification in E2E environment

## Notes

- The latest full checklist remains at `checklist.md`.
- Once any blocker is removed, add/enable its corresponding E2E case in `tests/e2e` and update both docs.
