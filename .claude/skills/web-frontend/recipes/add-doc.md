# Add or change a document of the docs

Documents live in `apps/web/app/features/docs/content/<locale>/<category>/<name>.mdx`, one file per language (`zh`, `en`, `ja`). The address of a document is `/<locale>/docs/<category>/<name>`.

## A new document

1. Write `content/zh/<category>/<name>.mdx`, then the same file under `content/en` and `content/ja`. A category is one of the folders `guides`, `about`, `dev` (`categories` in `docs.ts`; a new one also needs its name in `docs.category` of the three message files).
2. Start each file with its head:

```mdx
---
title: 如何下载游戏
banner: 'https://images.yurari.moe/…'
description: '一两句话的摘要，显示在标题下方和文档列表中，也用作页面描述。'
date: 2026-02-27
author_uid: 1
author_name: 'ringyuki'
author_avatar: 'https://t.shionlib.com/user/1/avatar/….webp'
---
```

`title` and `date` are required. The document appears in the index, the shelf and the previous and next links by itself: guides first, the newest first inside a category.

## Writing

- No `#` title is needed: the page shows `title`. Sections start at `##`; `##` and `###` make up the table of contents.
- A heading's anchor is made from its text, so renaming a heading changes its address.
- Links: `/zh/docs/guides/lunabox` (or without the language, which is then the reader's) for a page of this site, `#安装-lunabox` for a heading of the same document, a full address for anything else.
- Pictures go in `apps/web/public/assets/images/<name>/` and are written `![说明](/assets/images/<name>/picture.webp)`. Only files of the site work: the build measures each picture so the page keeps its place before it loads, and stops on one it cannot find. A screenshot taken at twice the density is named `…@2x.webp` and is shown at half its pixels. A screenshot of the site is taken once per language and kept under `<name>/<locale>/`, so each language's document shows the interface in that language (the three languages show the same number of pictures; the test below checks it); when the interface changes, the screenshots are taken again.
- An interface label a document quotes (a button, a menu item, a state) is the exact text of that language's messages (`app/features/*/messages/<locale>.json`), never a translation of the Chinese document's wording.
- Tables are GFM tables, code is a fenced block with its language. `<Ellipsis />` draws the mark of the more-actions menu. No other JSX, and no raw `<`, `>`, `{` or `}` in running text.

## Taking a document down

A document about something the site no longer has is deleted, not rewritten to keep it alive. Delete its file in the three languages and its pictures, and add its address to `retired` in `docs.ts`: the old address then answers with a permanent redirect to the list of documents instead of a 404. Remove the links other documents had to it (the test below fails on one that is left).

## Check

```bash
pnpm exec vitest run app/features/docs mdx
```

`docs.server.test.ts` fails when the three languages do not hold the same documents, when a document does not render, when two of its headings share an anchor, or when it links to a document that does not exist. Then open the page in each language.
