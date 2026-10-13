# Inboxes

Source notes the owner shares (articles, guides, research). Each topic folder has an `inbox/`: `docs/inbox/`, `docs/product-designer/inbox/`, `docs/backend/inbox/`. Read an item when its topic comes up.

## Add an item
Tell Claude: "şunu inbox'a ekle" with a link, text or note. Claude saves it as `<yyyy-mm-dd>-<slug>.md` in the matching inbox (the file must hold the content, not just a link):

```markdown
---
status: new            # new | done
from: owner            # owner | claude
source: <url or "owner note">
---
Why it matters: one line, in the owner's words.

Content: summary, key excerpts, numbers. Keep the source language.
```

One item, one idea. An item for several topics is copied to each inbox.

This README is not an item; an item has `status:` in its frontmatter.

## Process
Say "inbox'ı işle": Claude reads the `new` items, applies the lessons to the docs or code, and sets `status: done`.
