# ADR 0014: Recording what a file holds

## Context
A check decided whether an upload may be stored and kept nothing else. A resource page could show a file name, a size and a checksum, and nothing about what the file holds.

Production data (2026-10): 7,280 resources, one archive each, 14.4 TiB. 3,830 of them (53%, 7.1 TiB) hold disc images (iso+mds, mdf+mds, bin+cue, ccd); the rest hold game folders. A visitor had to download gigabytes to learn whether an archive holds an installer image or a folder ready to run, and which language its readme is in. The scan never looked inside a disc image, and scanned a nested archive as one stream.

## Decision
- **An inspection is the record of one check.** `internal/inspection` owns it: the archive's facts (format, solid, volumes, recovery record, encoding of its names), the totals, the scan that was run (engine, signature date, executables scanned, entries skipped for size, detections) and one entry per file and folder inside. A file points to its inspection (`game_download_resource_files.inspection_id`); the volumes of one archive share one. An inspection nothing points to any more (the file was replaced or removed) is deleted by `inspection_sweep` with its previews after an hour.
- **`internal/scan` reads, `internal/inspection` keeps.** The check lists and extracts once and uses the result twice: for the scan and for the record. `scan.ContentService` builds the tree and names what to scan and what to preview; `inspection.RecordService` arranges it (sizes of folders, files below each folder, order) and stores it.
- **Entries are rows.** `file_inspection_entries` has one row per entry, linked to its parent, with its position among its siblings computed when it is recorded (folders first, names in natural order), so a folder is paged by an index and never sorted. At most 200,000 entries are kept per inspection; the totals still count everything. The parent link has no foreign key: deleting an inspection would otherwise look up the children of every row it removes.
- **Nothing but the listing and the scan can fail a check.** Recording follows the scan and happens before the file is released; previews are kept after the file is released, and a store that fails there is reported without holding the file.
- **7-Zip lists and extracts; Go fills two gaps.**
  - Names of ZIP entries stored without the UTF-8 flag are read from the central directory with `archive/zip`, their encoding is detected from byte ranges (Shift_JIS, GBK, Big5, EUC-JP) and they are shown decoded. 7-Zip escapes the bytes it cannot decode one by one, so the names it gives entries stay distinct; extraction keeps using them, and the two listings are matched by position.
  - 7-Zip opens an ISO 9660 or UDF image of 2048-byte sectors, and nothing else. `adapter/discimage` finds the file system in images of raw sectors (2352, 2336, 2448 bytes, or after a lead-in), restores the data track to 2048-byte sectors in the workspace and reads the volume label; audio tracks come from the cue, ccd or mds sheet. Compressed or encrypted images (mdx, isz) are listed as unreadable.
- **Nested archives and disc images are containers.** They are extracted into the workspace, listed under their own entry, scanned entry by entry and previewed, up to three levels deep and only while the spool has room. What cannot be opened is still listed, marked `unreadable` (and `encrypted` when it asks for a password).
- **Previews are stored, not extracted on demand.** Text files up to 1 MB are kept as they are; the API returns the bytes with the encoding they look like and the browser decodes them, so the visitor can choose another encoding. Images are decoded and re-encoded as WebP fitted into 4096 pixels, which also guarantees that what is served is an image. Both live in the file bucket under `inspections/<inspection>/<entry>` and are served by the API under the visibility of the resource, never from a public address.
- **Every file gets a SHA-256** while it is checked, whatever hash its upload used.
- **Files published before are inspected by a command**, `shionlib-api inspect [limit]`: it takes the resources with files that have no inspection, most downloaded first, fetches each file from the bucket into the workspace and runs the steps of a check on it. It can be stopped at any time and continues where it stopped, because what is done is what has an inspection. A file that cannot be read gets an inspection that says so. An object the bucket does not hold leaves no trace, so a run against the wrong bucket changes nothing.
- **A detection in a published file holds it and waits for a person.** The backfill puts the file under review like an upload (case, messages, the resource hidden meanwhile), but the review deadline never removes a file that is already in object storage: `ExpiredCases` leaves those cases alone.

## Consequences
- The contents of an archive, its checks and its previews are on the resource page without the file being downloaded again.
- The table of entries grows with the catalogue: about 0.3 kB a row, so some gigabytes once every existing file is inspected.
- A check needs room for the disc images it extracts and for the restored copy of a raw image. An image the spool has no room for is listed as unreadable instead of failing the check.
- Inspecting the existing 14.4 TiB means downloading them once from the bucket.

## Alternatives considered
- **Keeping the tree as one compressed document per file** in the database or the bucket: smaller, but a folder of 12,000 entries and a search by name would mean reading and parsing megabytes for every request.
- **Listing on demand from the stored file**: no storage, but every page view would fetch a multi-gigabyte object.
- **Reading ISO 9660 in Go without restoring sectors**: no second copy on disk, but UDF and the odd cases 7-Zip already handles would have to be written again.
- **Serving previews from the public image bucket** with unguessable names: faster, but an archive of an adult game holds what the resource's visibility is there to hide.
