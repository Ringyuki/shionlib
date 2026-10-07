# ADR 0012: Multi-file resources, set-aware checks, publication and upload tiers

## Context
The legacy upload flow is built around one file per resource.
- Creating a resource takes exactly one upload session.
- Editing a resource renames every file it has.
- The scanner checks each file on its own, so split archives cannot be uploaded.
- The browser must read the whole file once to compute its BLAKE3 digest before the upload can start.

Production data (2026-10) shows the effect: all 7396 resources hold a single file, all of them `.rar`, `.zip` or `.7z`, with no split volumes and no raw disc images. Uploaders repack everything into one archive because nothing else is accepted.

The upload quota was a counter per user (`user_upload_quotas.size`/`used`). Five cron tasks changed it: 5 GB granted seven days after registration, 2 GB top-ups up to 20 GB, reductions after 45 days without uploads, `used` reset every month and the whole quota reset after 120 days of inactivity. Uploads charged it when they started; aborts, rejections, deletions and malware reviews refunded it, and report penalties subtracted from it. A refund missed on any of these paths drifted the counter, and the monthly reset let anyone upload the cap again each month whatever they had uploaded before. The limit did not depend on whether an uploader's resources had ever been published, and nothing limited how much the spool had to hold at once.

Malware scanning streamed whole files to ClamAV. The legacy `clamscan` skipped files over 100 MB (the median upload is 1.4 GB). clamd rejects streams over its 100 MB default, so the Go scanner failed on most uploads. In the site's history there were two ClamAV detections and two malware reports; all four were judged false positives or invalid.

## Decision
- **Resources hold a set of files.**
  - `POST /game/{id}/download-source` takes `files: [{upload_session_id, file_name?}]`, at most `download.max_files_per_resource`, and returns the resource id.
  - Owners and admins append files (`POST /game/download-source/{id}/files`), delete a file (`DELETE /game/download-source/file/{fileId}`, never the last one) and rename a file (`PATCH /game/download-source/file/{fileId}`).
  - Editing a resource no longer renames files.
  - The upload session belongs to the file. `game_download_resources.upload_session_id` is dropped; file history keeps every session a file ever had.
- **The whole-file digest is sent when the upload completes** (`PATCH /uploads/large/{id}/complete` with `file_sha256`), not when it starts. The client hashes while it uploads and reads the file once. Every chunk still carries its own SHA-256.
- **Publication.** A resource is published (`published_at`) when every file it has is in object storage. Only published resources are shown to other users:
  - on game pages and game cards;
  - in lists filtered by resources;
  - in recent releases, which are ordered by publication time;
  - on user pages.
  Uploaders always see their own resources and files with their processing state. Files appended to a published resource stay hidden until they are stored.
- **Set-aware checks.**
  - File names are unique within a resource, so the volumes of a set cannot clash.
  - Files whose names form a split archive (`.partN.rar`, `.rar`+`.rNN`, `.NNN`, `.zNN`+`.zip`) are grouped. They are hard-linked under their own names into a scan workspace on the spool and checked together by 7-Zip from the volume it opens (the first one, or the `.zip` of a split zip).
  - A set whose names show a gap or a missing first or last volume waits `scan.incomplete_set_timeout` (24 hours) for the uploader to add the missing volumes. A missing last volume of a RAR or 7z set, or a broken volume, shows up in the test.
  - The check task takes every active resource with files waiting for a check, so a set waiting for its volumes never holds up other uploads. A resource whose check fails, for example while clamd is down, is tried again after 30 minutes.
  - Encrypted archives stay rejected.
  - Raw disc images are not accepted at the top level; listing and extracting images inside archives is a later phase.
- **Malware scanning stays on ClamAV** but scans what matters.
  - One 7-Zip pass extracts the executables, scripts and nested archives of an archive or set into the workspace, matched by extension without regard to case. Each one is then streamed to ClamAV. A file uploaded as an executable is also scanned whole.
  - Extracting entry by entry would decompress a solid archive from its start for every entry.
  - Other entries are not scanned. Every scanned entry is written to the scan log, and a quarantine case keeps each entry's result.
  - clamd's stream and scan limits are 4000M, in one `infra/clamav/clamd.conf` mounted in production and copied into the e2e image. Entries larger than that are neither extracted nor scanned. The wait for clamd's reply grows with the bytes sent.
  - The sizes come from the 7-Zip listing. Extraction only starts if the entries fit on the spool without touching its reserve and the bytes live uploads still have to write; otherwise the check is tried again later. An extraction cut short by its timeout is treated like a timed out test: what was extracted is scanned.
  - The scanner is a port, so another engine only needs an adapter. A confirmed miss is the trigger to change engines.
  - Targeted tampering is handled by uploader trust tiers (below) and by later phases: listing rules, and comparing executables with trusted uploads of the same game.
- **Resource-level outcomes.**
  - A rejected file, or every file of a rejected or expired set, is marked with its reason and removed by the cleanup task. The rest of the resource publishes once it is stored; a resource left without files is deleted.
  - Corrupt sets are removed whole because 7-Zip cannot name the broken volume.
  - A file under malware review hides the whole resource, including download links to its stored files; this is derived from the files, not stored on the resource. Only admins can delete a file under review. Confirmed malware takes the whole resource down, purges its files, and keeps the existing strikes and ban. A false positive releases every held file of the resource.
  - Files of a removed resource are no longer checked, stored or published; the cleanup task deletes their local copies.
  - Uploaders get one message when a resource is published (`ResourcePublished`), however the last unfinished file went (stored, rejected or deleted), one per file added to an already published resource, and one per rejected file or set naming the files, the reason and any missing volume numbers.

- **Upload allowance follows the uploader's tier and is derived from records**, so nothing is charged, refunded or reset.
  - *Stored* bytes are the uploader's files in active resources plus finished uploads not yet in a resource. *In-flight* bytes are uploads in progress. Deleting a resource or a rejected file frees its space at once.
  - A resource is created only once all its files are uploaded, so finished uploads count as stored rather than in flight; otherwise a resource larger than the in-flight limit could never be completed.
  - Tiers, with every number a setting: new uploader (`upload.new_uploader_quota`, 50 GiB); regular after `upload.regular_after` (3) published resources (`upload.regular_quota`, 300 GiB); trusted after `upload.trusted_after` (30) published resources or when an admin grants it (`PATCH /admin/users/{id}/upload-trust`, `upload.trusted_quota`, 2 TiB); admins unlimited. Stored plus in-flight bytes stay within the tier's limit.
  - A violation is malware confirmed by an admin or a valid report of medium level or above. It drops the uploader one tier for `upload.violation_freeze` (30 days), and a regular uploader stays a new uploader while the violation is within `upload.violation_window` (90 days). Bans and their messages are unchanged; the penalty message says whether the tier dropped.
  - Every uploader has at most `upload.in_flight_limit` (30 GiB) in flight (`USER_UPLOAD_IN_FLIGHT_EXCEEDED`). New and regular uploaders have at most `upload.max_file_size` (30 GiB) per file.
- **Upload sessions follow the browser's upload manager.**
  - Every accepted chunk extends the session by `upload.session_ttl`, so a session expires only after that long without progress.
  - `GET /uploads/large/ongoing` also lists finished uploads not yet in a resource (`status: COMPLETED`), and `DELETE /uploads/large/{id}` discards them.
  - A finished upload not yet in a resource is cleaned up six hours after it finished, but only while its uploader has no upload in progress, so the first files of a resource wait for the last one.
  - Completing a session again with the same digest succeeds, so a client can retry a completion whose response it never received.
  - Removing a file, removing a resource or replacing a file's content retires the sessions it used, so they never come back as finished uploads.
  - An upload starts only if the spool keeps `upload.spool_reserve` (20 GiB) free after the bytes that live uploads have still to write (`UPLOAD_SPOOL_FULL`). Uploads are admitted one at a time under a transaction lock, so concurrent starts cannot overrun these limits.
  - `GET /uploads/quota` returns the tier, the counts behind it, any freeze, and the usage and limits.

## Alternatives
- Keep one file per resource: uploaders keep repacking, and split downloads from other sources cannot be shared as they are.
- Accept raw disc images now: nobody uploads them, and they download worse than an archive.
- Defender in a Windows VM, or a commercial Linux engine: better detection, but a new machine or a yearly license plus upkeep, for a threat that has not materialised. Static engines do not stop targeted tampering either.
- Keep the quota counter and its cron tasks: every path that frees space must refund it exactly once, and the monthly reset makes the limit a monthly allowance instead of a cap on what an uploader holds.
- Derive publication from file states on every query: it cannot keep a published resource visible while an appended file is processed, and it cannot order releases by publication.

## Consequences
- New column `published_at` (backfilled from `created` for resources whose files are all stored); `upload_session_id` is dropped.
- New column `check_retry_at` on resources and a unique index on `(game_download_resource_id, file_name)`.
- Clients of the old create and init endpoints must send the new shapes (see migration.md).
- Scanning reads each archive with 7-Zip instead of streaming it whole, which makes ClamAV coverage independent of archive size.
- `user_upload_quotas` and `user_upload_quota_records` are dropped and `users.upload_trusted` is added. The admin quota endpoints give way to the upload-trust endpoint, and report penalties no longer subtract bytes.
