# ADR 0013: Rich text documents instead of Lexical state and stored HTML

## Context
Comments and walkthroughs were written in a Lexical editor. The legacy backend stored two things for each: the editor's state (`content`, the JSON Lexical serializes) and `html`, rendered from it on the server. The Go backend kept both, so it carried a renderer that reproduced the legacy markup, a CSS sanitizer for the inline styles Lexical keeps on text, and a hand-kept list of node types.

That format has no schema. Any tree of known node types was accepted, formats were bit masks, colours and sizes were CSS strings, and what a document may contain was decided by whichever editor wrote it. The new web client never showed the stored HTML; it converted the state to BBCode and back, because no editor was in place.

Production data (2026-10): 221 comments and 36 walkthroughs. Every text node is unformatted; besides paragraphs there are five links, one heading, one list of three items, one hashtag and one image.

The new client needs one editor for every formatted text a user writes: it stores a document with a schema, shows it read-only without loading the editor, and offers a different set of capabilities per field. That is how ProseMirror works, so the client builds its editor on Tiptap, and the stored format follows.

## Decision
- **A rich text document is the stored and transmitted form** (`internal/richtext`). It is the JSON ProseMirror serializes: `{"type":"doc","content":[...]}`, nodes with `type`, `attrs`, `content`, `marks` and `text`. Nothing else is stored: no HTML, no styles, no editor versions.
- **The vocabulary is closed, and its names are snake_case** like every other value of the API.
  - Blocks: `paragraph`, `heading` (level 2 or 3), `blockquote`, `bullet_list`, `ordered_list`, `list_item`, `horizontal_rule`, `image_block`, `table`, `table_row`, `table_header`, `table_cell`.
  - Inline: `text`, `hard_break`.
  - Marks: `bold`, `italic`, `strike`, `link` (`href`, an `http`, `https` or `mailto` address of at most 2000 characters) and `spoiler`.
  - An `image_block` carries `src`, `width`, `height` and optionally `alt`, `caption` and `width_percent` (the share of the text column it is shown at, 20 to 100; it is never shown wider than it is). A table cell carries `colspan`, `rowspan`, `colwidth` (one width per column it spans, or none) and optionally `align` (`left`, `center`, `right`), and holds paragraphs only.
- **A schema names what a field accepts.** `richtext.Comment` takes paragraphs and line breaks with bold, links and spoilers. `richtext.Article` (walkthroughs) takes the whole vocabulary, at most 50 images and 20 tables.
- **`richtext.Parse(raw, schema)` is the only way in.** It refuses unknown fields and attributes, node and mark types outside the schema, attributes on a node they do not belong to, a node in a place the content model does not allow (the same rules as the client's editor: a list holds items, an item starts with a paragraph, a row holds cells, text sits in paragraphs and headings), empty text nodes, repeated marks, other link addresses, pictures that were not uploaded here, more pictures or tables than the schema allows and nesting deeper than 32. What it returns is canonical: `Raw()` is re-encoded from the parsed tree, so only what was checked is stored.
- **Pictures are uploaded before they are written.** `PUT /uploads/small/richtext/image` (any signed-in user, 10 MiB) stores the picture as WebP, at most 1600 pixels wide and never enlarged, under `richtext/<user id>/<uuid>.webp`, and answers with the key and the stored size. A document may only name such a key as the `src` of an `image_block`, so it cannot point at another site or at another kind of object.
- **The contract describes the document.** `richtexthttp.Content` carries the stored JSON through requests and responses unchanged and gives it the schemas `RichTextDocument`, `RichTextNode` and `RichTextMark`, whose type lists come from `internal/richtext`. A request is checked twice: against the contract by Huma, then by `richtexthttp.Parse` against the field's schema, for text and for length; every refusal is a 422 on `content`.
- **`text` replaces `html`.** `comments.text` and `walkthroughs.text` hold the document's plain text, one line per block, captions included. It is what the moderation screening reads, what the admin lists search and show, and what comparisons use to tell whether content changed. Every DTO that carried `html` carries `text` instead. Lengths (`comment.MaxContentLength`, `walkthrough.MaxContentLength`) count the characters of the text nodes in UTF-16 units, as the browser does.
- **A walkthrough also keeps an excerpt.** `walkthroughs.excerpt` holds the first 200 characters of the text with blocks joined by spaces and everything marked as a spoiler left out (`Document.Excerpt`). Lists show it, so they never load documents and never give a spoiler away.
- **Existing content is converted once, by a migration** (`20261009165949_rich_text_documents`). It keeps every original `content` and `html` in `legacy_editor_contents`, rewrites `content` in place and fills `text` and `excerpt`.
  - Comments are converted to the comment schema: every block becomes a paragraph, and of the formats only bold survives beside links and spoilers.
  - Walkthroughs keep headings (`h1` and `h2` become level 2, the others level 3), lists, quotes, rules and tables (a cell keeps its text as paragraphs).
  - What the vocabulary lacks keeps its text: a code block becomes a paragraph, a picture becomes its description or address as a link (it was never stored here), colours, sizes, underline and inline code are dropped.
  - The down migration restores the originals.

## Consequences
- The server no longer renders or sanitizes HTML, and no client may expect it. Whatever shows a document renders it from the JSON.
- Adding a capability is one change in three places, in this order: the node or mark in `internal/richtext` (vocabulary, content rule, attributes, schema), the OpenAPI contract that follows from it, and the client's plugin, profile and read-only view.
- A picture that was uploaded and never written into a saved document stays in the bucket. Nothing collects such pictures yet.
- A document written by a newer client than the server knows is refused, not stored and ignored.
- `legacy_editor_contents` exists for the rollback of the cutover and is dropped by a later migration once the legacy backend is gone.
- Rolling back after users wrote with the new editor loses those texts' formatting for the legacy backend, which cannot read the new form; rows without a kept original are left as they are.
