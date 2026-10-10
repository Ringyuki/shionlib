# ADR 0013: Rich text documents instead of Lexical state and stored HTML

## Context
Comments and walkthroughs were written in a Lexical editor. The legacy backend stored two things for each: the editor's state (`content`, the JSON Lexical serializes) and `html`, rendered from it on the server. The Go backend kept both, so it carried a renderer that reproduced the legacy markup, a CSS sanitizer for the inline styles Lexical keeps on text, and a hand-kept list of node types.

That format has no schema. Any tree of known node types was accepted, formats were bit masks, colours and sizes were CSS strings, and what a document may contain was decided by whichever editor wrote it. The new web client never showed the stored HTML; it converted the state to BBCode and back, because no editor was in place.

Production data (2026-10): 221 comments and 36 walkthroughs. Every text node is unformatted; besides paragraphs there are five links, one heading, one list of three items, one hashtag and one image.

The new client needs one editor for every formatted text a user writes: it stores a document with a schema, shows it read-only without loading the editor, and offers a different set of capabilities per field. That is how ProseMirror works, so the client builds its editor on Tiptap, and the stored format follows.

## Decision
- **A rich text document is the stored and transmitted form** (`internal/richtext`). It is the JSON ProseMirror serializes: `{"type":"doc","content":[...]}`, nodes with `type`, `content`, `marks` and `text`. Nothing else is stored: no HTML, no styles, no editor versions.
- **The vocabulary is closed, and its names are snake_case** like every other value of the API.
  - Blocks: `paragraph`.
  - Inline: `text`, `hard_break`.
  - Marks: `bold`, `link` (`href`, an `http`, `https` or `mailto` address of at most 2000 characters) and `spoiler`.
  - Until 2026-10-11 it also had what walkthroughs written as articles used: headings, lists, quotes, rules, pictures and tables, the marks `italic` and `strike`, a second schema (`richtext.Article`) and an upload for pictures (`PUT /uploads/small/richtext/image`). Walkthroughs became routes of steps (migration `20261010174201_walkthrough_routes`), nothing used that part any more, and it was removed from the API and from the client's editor.
- **A schema names what a field accepts.** `richtext.Comment` takes paragraphs and line breaks with bold, links and spoilers; comments and the note of a walkthrough use it, and it is the only schema at present. A field with other needs gets a schema of its own.
- **`richtext.Parse(raw, schema)` is the only way in.** It refuses unknown fields, attributes on a node, node and mark types outside the schema, a node in a place the content model does not allow (text sits in paragraphs, paragraphs in the document), empty text nodes, repeated marks and other link addresses. What it returns is canonical: `Raw()` is re-encoded from the parsed tree, so only what was checked is stored.
- **The contract describes the document.** `richtexthttp.Content` carries the stored JSON through requests and responses unchanged and gives it the schemas `RichTextDocument`, `RichTextNode` and `RichTextMark`, whose type lists come from `internal/richtext`. A request is checked twice: against the contract by Huma, then by `richtexthttp.Parse` against the field's schema, for text and for length; every refusal is a 422 on `content`. A field that may be left out (`note` of a walkthrough) goes through `richtexthttp.ParseOptional`, which takes the field's name and treats a document without text as left out.
- **`text` replaces `html`.** `comments.text` holds the document's plain text, one line per paragraph; `walkthroughs.text` holds the note's text followed by what every route says (name, condition, steps, ending). It is what the moderation screening reads, what the admin lists search and show, and what comparisons use to tell whether content changed. Every DTO that carried `html` carries `text` instead. Lengths (`comment.MaxContentLength`, `walkthrough.MaxNoteLength`) count the characters of the text nodes in UTF-16 units, as the browser does.
- **Existing content is converted once, by a migration** (`20261009165949_rich_text_documents`). It keeps every original `content` and `html` in `legacy_editor_contents`, rewrites `content` in place and fills `text` (and the walkthrough `excerpt`, a column the later migration dropped).
  - Comments are converted to the comment schema: every block becomes a paragraph, and of the formats only bold survives beside links and spoilers.
  - Walkthroughs kept headings, lists, quotes, rules and tables at that point; the walkthrough migration that followed keeps their text alone, as the paragraphs of the note.
  - What the vocabulary lacks keeps its text: a code block becomes a paragraph, a picture becomes its description or address as a link (it was never stored here), colours, sizes, underline and inline code are dropped.
  - The down migration restores the originals.

## Consequences
- The server no longer renders or sanitizes HTML, and no client may expect it. Whatever shows a document renders it from the JSON.
- Adding a capability is one change in three places, in this order: the node or mark in `internal/richtext` (vocabulary, content rule, schema), the OpenAPI contract that follows from it, and the client's plugin, profile and read-only view.
- A document written by a newer client than the server knows is refused, not stored and ignored.
- `legacy_editor_contents` exists for the rollback of the cutover and is dropped by a later migration once the legacy backend is gone.
- Rolling back after users wrote with the new editor loses those texts' formatting for the legacy backend, which cannot read the new form; rows without a kept original are left as they are.
