# ADR 0012: Multi-file resources, set-aware checks and publication

## Context
The legacy upload flow is built around one file per resource.
- Creating a resource takes exactly one upload session.
- Editing a resource renames every file it has.
- The scanner checks each file on its own, so split archives cannot be uploaded.
- The browser must read the whole file once to compute its BLAKE3 digest before the upload can start.

Production data (2026-10) shows the effect: all 7396 resources hold a single file, all of them `.rar`, `.zip` or `.7z`, with no split volumes and no raw disc images. Uploaders repack everything into one archive because nothing else is accepted.

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
  - Files whose names form a split archive (`.partN.rar`, `.rar`+`.rNN`, `.NNN`, `.zNN`+`.zip`) are grouped. They are hard-linked under their own names into a scan workspace on the spool and checked together by 7-Zip from the volume it opens (the first one, or the `.zip` of a split zip).
  - A set whose names show a gap or a missing first or last volume waits `scan.incomplete_set_timeout` (24 hours) for the uploader to add the missing volumes. A missing last volume of a RAR or 7z set, or a broken volume, shows up in the test.
  - Encrypted archives stay rejected.
  - Raw disc images are not accepted at the top level; listing and extracting images inside archives is a later phase.
- **Malware scanning stays on ClamAV** but scans what matters.
  - One 7-Zip pass extracts the executables, scripts and nested archives of an archive or set into the workspace, matched by extension without regard to case. Each one is then streamed to ClamAV. A file uploaded as an executable is also scanned whole.
  - Extracting entry by entry would decompress a solid archive from its start for every entry.
  - Other entries are not scanned. Every scanned entry is written to the scan log, and a quarantine case keeps each entry's result.
  - clamd's stream and scan limits are 4000M, in one `infra/clamav/clamd.conf` mounted in production and copied into the e2e image.
  - The scanner is a port, so another engine only needs an adapter. A confirmed miss is the trigger to change engines.
  - Targeted tampering is handled by later phases: uploader trust tiers, listing rules, and comparing executables with trusted uploads of the same game.
- **Resource-level outcomes.**
  - A rejected file, or every file of a rejected or expired set, is marked with its reason and removed by the cleanup task with its quota returned. The rest of the resource publishes once it is stored; a resource left without files is deleted.
  - Corrupt sets are removed whole because 7-Zip cannot name the broken volume.
  - A file under malware review hides the whole resource; this is derived from the files, not stored on the resource. Confirmed malware takes the whole resource down, refunds and purges its files, and keeps the existing strikes and ban. A false positive releases every held file of the resource.
  - Uploaders get one message when a resource is published (`ResourcePublished`), one per file added to an already published resource, and one per rejected file or set naming the files, the reason and any missing volume numbers.

## Alternatives
- Keep one file per resource: uploaders keep repacking, and split downloads from other sources cannot be shared as they are.
- Accept raw disc images now: nobody uploads them, and they download worse than an archive.
- Defender in a Windows VM, or a commercial Linux engine: better detection, but a new machine or a yearly license plus upkeep, for a threat that has not materialised. Static engines do not stop targeted tampering either.
- Derive publication from file states on every query: it cannot keep a published resource visible while an appended file is processed, and it cannot order releases by publication.

## Consequences
- New column `published_at` (backfilled from `created` for resources whose files are all stored); `upload_session_id` is dropped.
- Clients of the old create and init endpoints must send the new shapes (see migration.md).
- Scanning reads each archive with 7-Zip instead of streaming it whole, which makes ClamAV coverage independent of archive size.
