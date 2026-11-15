# Issue #20 Round-Trip Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issue #20 (`JeromeErasmus/extended-markdown-adf-parser#20`) so `markdownToAdf(adfToMarkdown(doc))` round-trips correctly for `textColor`, `underline`, `emoji`, `mention`, table cells containing `|`, and code blocks containing a nested fence — 6 of the issue's 7 reported cases.

**Architecture:** Three independent fixes to the `Parser`/`MarkdownToAdfEngine` mdast conversion pipeline in `extended-markdown-adf-parser`: (1) a new HTML-tag pairing pass so `<span style="color:...">`/`<u>` round-trip as marks, (2) a dedicated metadata-comment pre-pass so `emoji`/`mention` nodes survive round-trip, (3) narrow, unconditional escaping in two ADF→Markdown node converters. Each ships as its own branch/PR, merged and verified green before the next starts.

**Tech Stack:** TypeScript, Jest (`node --experimental-vm-modules`), `unified`/`remark-parse`/`remark-gfm` (mdast), `tsup` (build).

**Spec:** `docs/superpowers/specs/2026-11-15-issue-20-roundtrip-fidelity-design.md`

## Global Constraints

- No regressions: the full suite (`npm test`) and both fixture suites (`tests/integration/markdown-to-adf-fixtures.test.ts`, `tests/integration/adf-fixtures-integration.test.ts`) must be green after every task, not just at the end.
- `npm run build` must be checked for an "error" string and exit code explicitly (not just the last few lines) before any push — this session already shipped one broken build by only tailing output.
- Scope is the mdast pipeline only (`MarkdownToAdfEngine` / `ASTBuilder`'s `convertMdast*`-prefixed methods), reached via `Parser.markdownToAdf()` — the same class issue #20's repro uses. Do not touch `MarkdownParser`'s separate token-based pipeline (`MarkdownTokenizer` + `ASTBuilder.buildADF(tokens)` + `convertList`/`convertFormattingToken`-prefixed methods) — it is a different, already-separately-buggy pipeline out of scope for this issue.
- Fixtures: only create new ones or touch the specific files this plan names. No speculative/bulk fixture regeneration.
- Each bucket's fixture pair is generated from real converter output (`JSON.stringify(adf, null, 2)` / actual `adfToMarkdown()`/`markdownToAdf()` calls), never hand-typed markdown guesses — matches this session's established fixture convention.
- Branch naming/workflow: branch off current `main`, build + full suite green, push, `gh pr create`, comment explaining the fix, merge, sync local `main` — matches the workflow used for PRs #6/#9/#10/#12/#14/#16/#18/#19 earlier this session.
- Plain-text escaping (heading/emphasis/link misparse — issue #20's 7th case) is explicitly out of scope. File a follow-up GitHub issue after Task 3 ships.
- **Manual visual gate:** before any commit/push/PR, each task has a step where the coordinating session runs the actual before/after output live and shows it to the user for visual inspection, then waits for their explicit go-ahead. This step cannot be closed out by an unattended subagent — it requires the human in the loop, so it always runs in the main coordinating session regardless of execution method.

## Review Focus

- **Nested/nesting marks inside the HTML-tag pair** (bucket 1): `<span style="color:#ff0000"><u>x</u></span>` — the pairing pass must recurse, not just strip the outer tags and flatten the inner `<u>` to plain text.
- **A table cell with multiple `|` characters, or `|` in both header and data cells** (bucket 3): the escaping must apply per-occurrence, not just the first, and must apply identically in `TableCellConverter` and `TableHeaderConverter` (two separate files/classes today, no shared helper).
- **A link that legitimately uses an `adf://mention/`-shaped URL with no accompanying `adf:mention` comment** (bucket 2): must still produce a plain `link` mark, not be swallowed by the new pre-pass — this is the anti-goal the design doc calls out explicitly.
- **A code block whose content is backtick runs of varying lengths** (e.g. a 2-backtick run and a 4-backtick run in the same block) (bucket 3): the fence-length rule must use more backticks than the *longest* run present, not just count occurrences of exactly ` ``` `.
- **Arbitrary HTML this library did not write** (bucket 1): a `<div>`, `<img>`, or malformed/unclosed `<span>` must still fall through to today's `[HTML: ...]` placeholder unchanged — the pairing pass must not misfire on content it doesn't recognize.

---

## Task 1: Bucket 1 — Mark-as-HTML decoding (`textColor`, `underline`)

**Files:**
- Create: `tests/unit/parser/mark-as-html-roundtrip.test.ts`
- Modify: `src/parser/markdown-to-adf/ASTBuilder.ts` (`convertMdastInlineNodes`, around line 2043; add a new private helper method near it)

**Interfaces:**
- Consumes: existing `wrapWithMark(children, markType, attrs?)` and `addMarkWithCodeExclusivity(marks, mark)` (already defined in `ASTBuilder.ts`, used by the #6/#10 fixes this session) for applying the decoded mark to text content.
- Produces: `convertMdastInlineNodes(nodes: any[]): ADFNode[]` keeps its existing signature and call sites unchanged — this task changes its internals only, nothing downstream needs to know about the new behavior.

- [ ] **Step 1: Create a feature branch**

```bash
git checkout main && git pull --ff-only
git checkout -b fix/issue-20-mark-as-html
```

- [ ] **Step 2: Write the failing fixture test**

In `tests/unit/parser/mark-as-html-roundtrip.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

describe('Mark-as-HTML round-trip (issue #20)', () => {
  it('reproduces comprehensive-marks.adf textColor/underline marks from its own .md', () => {
    const parser = new Parser();
    const markdown = readFileSync(join(fixturesDir, 'markdown/comprehensive-marks.md'), 'utf-8');
    const expectedAdf = JSON.parse(readFileSync(join(fixturesDir, 'adf/comprehensive-marks.adf'), 'utf-8'));

    const result = parser.markdownToAdf(markdown);

    const findText = (node: any, text: string): any => {
      if (node.type === 'text' && node.text === text) return node;
      for (const child of node.content || []) {
        const found = findText(child, text);
        if (found) return found;
      }
      return null;
    };

    for (const text of ['underlined text', 'colored text', 'bold underlined link', 'hex color', 'RGB color', 'named color']) {
      const expected = findText({ content: expectedAdf.content }, text);
      const actual = findText({ content: result.content }, text);
      expect(actual?.marks).toEqual(expected?.marks);
    }
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/mark-as-html-roundtrip.test.ts`
Expected: FAIL — actual marks show the `[HTML: <span...>]`/`[HTML: <u>]` placeholder text instead of `textColor`/`underline` marks (or the assertion fails because `actual?.marks` is `undefined`/wrong).

- [ ] **Step 4: Implement the HTML-tag pairing pass**

Add a new private method `private pairHtmlMarkTags(nodes: any[]): any[]` in `ASTBuilder.ts`, called at the top of `convertMdastInlineNodes` to pre-process `nodes` before the existing per-node loop. It scans for an opening `html` node matching `/^<span style="color:\s*(#[0-9a-fA-F]{3,8}|\w+)">$/` or exactly `<u>`, finds the next sibling `html` node that is the matching close tag (`</span>`/`</u>`), and replaces the whole matched range (open tag, content nodes in between, close tag) with content wrapped via `wrapWithMark(contentBetween, 'textColor', { color })` or `wrapWithMark(contentBetween, 'underline')`. Recurse on `contentBetween` first (via a self-call) so a nested pair (e.g. `<u>` inside `<span>`) composes correctly before the outer wrap applies. Anything not matching either pattern passes through unchanged, preserving today's `[HTML: ...]` fallback for arbitrary HTML.

- [ ] **Step 5: Run the fixture test to verify it passes**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/mark-as-html-roundtrip.test.ts`
Expected: PASS

- [ ] **Step 6: Add focused unit tests for the Review Focus cases**

In the same test file, add:
- `'wraps nested <u> inside <span style="color:...">'`: markdown `` <span style="color: #ff0000"><u>x</u></span> `` round-trips to a text node with `marks: [{type:'underline'}, {type:'textColor', attrs:{color:'#ff0000'}}]` (or the reverse composition order — assert whichever order `wrapWithMark`'s recursion naturally produces, then pin it).
- `'leaves unrecognized HTML as the existing placeholder'`: markdown `<div>x</div>` still produces `[HTML: <div>]`/`[HTML: </div>]` text nodes, unchanged.
- `'leaves an unclosed <span> as the existing placeholder'`: markdown `<span style="color: #ff0000">x` (no closing tag) still produces the `[HTML: ...]` placeholder for the opening tag, not a thrown error or swallowed content.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all suites pass, 0 failures (note the exact pass count for the commit message).

- [ ] **Step 8: Build and verify explicitly (no error string, exit code 0)**

Run: `npm run build > /tmp/build1.log 2>&1; echo "EXIT: $?"; grep -i error /tmp/build1.log`
Expected: `EXIT: 0` and the `grep` finds nothing (or only benign matches like `ErrorRecovery.ts`/`errors.mjs` filenames — confirm by reading any match, don't assume).

- [ ] **Step 9: Manual before/after demo — wait for user go-ahead**

With the fix committed in the working tree but not yet staged for this step, run the exact markdown from issue #20's `textColor`/`underline` repro cases through `parser.adfToMarkdown()` then `parser.markdownToAdf()`, twice: once with the fix stashed out (`git stash` the uncommitted changes, run, print result), once with it restored (`git stash pop`, run, print result). Show the user both outputs side by side — "before" should show the `[HTML: ...]` corruption, "after" should show the correct `textColor`/`underline` marks. Wait for the user's explicit go-ahead before proceeding to Step 10. Do not commit until they've confirmed.

- [ ] **Step 10: Commit**

```bash
git add tests/unit/parser/mark-as-html-roundtrip.test.ts src/parser/markdown-to-adf/ASTBuilder.ts
git commit -m "Fix: decode <span style=color> and <u> HTML tags back into textColor/underline marks (#20)"
```

- [ ] **Step 11: Push and open the PR**

```bash
git push -u origin fix/issue-20-mark-as-html
gh pr create --repo JeromeErasmus/extended-markdown-adf-parser \
  --title "[TECH] Decode mark-as-HTML (textColor, underline) on round-trip" \
  --body "Fixes part of #20: markdownToAdf(adfToMarkdown(doc)) now round-trips textColor and underline marks, which were previously corrupted into literal [HTML: ...] placeholder text. New pairing pass recognizes exactly the two HTML shapes this library's own encoder emits; arbitrary HTML is unaffected.

Verified against the existing comprehensive-marks fixture (its .adf was already correct; the markdownToAdf direction had just never been tested).

Full suite green."
```

- [ ] **Step 12: Merge and sync local main**

Confirm CI/mergeable status, then:
```bash
gh pr merge --repo JeromeErasmus/extended-markdown-adf-parser --merge <PR_NUMBER>
git checkout main && git pull --ff-only
```

---

## Task 2: Bucket 2 — Metadata comment consumption (`emoji`, `mention`)

**Files:**
- Create: `tests/fixtures/adf/emoji-mention-roundtrip.adf`
- Create: `tests/fixtures/markdown/emoji-mention-roundtrip.md`
- Create: `tests/unit/parser/emoji-mention-roundtrip.test.ts`
- Modify: `src/utils/metadata-comments.ts` (new function, called from `processMetadataComments`)
- Modify: `src/parser/markdown-to-adf/ASTBuilder.ts` (`convertMdastInlineNode`'s `'text'`/`'link'` cases, around line 2063+, to consume the new pre-pass's output)

**Interfaces:**
- Consumes: `isAdfMetadataComment(value: string): boolean`, `parseAdfMetadataComment(value: string): AdfMetadata | null` (both already exported from `metadata-comments.ts`).
- Produces: new exported function `processEmojiMentionMetadataComments(tree: Root): Root` in `metadata-comments.ts`, called from `processMetadataComments` (same file) alongside the existing `processSpanMetadataComments` call, before the generic comment-attachment `visit` loop.

- [ ] **Step 1: Create a feature branch from updated main**

```bash
git checkout main && git pull --ff-only
git checkout -b fix/issue-20-emoji-mention-metadata
```

- [ ] **Step 2: Hand-craft the fixture ADF**

Write `tests/fixtures/adf/emoji-mention-roundtrip.adf`:

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Reacting with " },
        { "type": "emoji", "attrs": { "shortName": ":smile:", "text": "😄" } },
        { "type": "text", "text": " cc " },
        { "type": "mention", "attrs": { "id": "abc", "text": "@abc" } }
      ]
    }
  ]
}
```

- [ ] **Step 3: Generate the fixture markdown from current (unbroken) encode output**

```bash
cat > /tmp/gen-emoji-mention.mjs <<'EOF'
import { Parser } from '../../src/index.js';
import { readFileSync, writeFileSync } from 'fs';
const parser = new Parser();
const adf = JSON.parse(readFileSync('tests/fixtures/adf/emoji-mention-roundtrip.adf', 'utf-8'));
writeFileSync('tests/fixtures/markdown/emoji-mention-roundtrip.md', parser.adfToMarkdown(adf));
EOF
```

Run this via a throwaway Jest test (project has no bare `node --loader` ESM-from-src runner), confirm the written `.md` contains both `<!-- adf:emoji ... -->` and `<!-- adf:mention ... -->`, then delete the throwaway test.

- [ ] **Step 4: Write the failing round-trip test**

In `tests/unit/parser/emoji-mention-roundtrip.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

describe('Emoji/mention metadata round-trip (issue #20)', () => {
  it('reproduces emoji and mention nodes from their encoded markdown', () => {
    const parser = new Parser();
    const markdown = readFileSync(join(fixturesDir, 'markdown/emoji-mention-roundtrip.md'), 'utf-8');
    const expectedAdf = JSON.parse(readFileSync(join(fixturesDir, 'adf/emoji-mention-roundtrip.adf'), 'utf-8'));

    const result = parser.markdownToAdf(markdown);

    expect(result.content).toEqual(expectedAdf.content);
  });

  it('does not misfire on a real adf://mention/-shaped link with no comment', () => {
    const parser = new Parser();
    const result = parser.markdownToAdf('[@abc](adf://mention/abc)');
    const textNode = result.content[0].content[0];
    expect(textNode.marks).toEqual([{ type: 'link', attrs: { href: 'adf://mention/abc' } }]);
  });
});
```

- [ ] **Step 5: Run both tests, confirm the first fails and note the second's current status**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/emoji-mention-roundtrip.test.ts`
Expected: first test FAILS (emoji dropped and/or mention downgraded to a `link` mark); second test currently PASSES already (this is the pre-existing, correct behavior the fix must not break — keep it in the suite as a guard, not because it's red today).

- [ ] **Step 6: Implement the dedicated metadata pre-pass**

Add `export function processEmojiMentionMetadataComments(tree: Root): Root` to `metadata-comments.ts`, visiting the tree for: (a) a `text` node immediately followed by an `html` sibling whose value matches `/^<!--\s*adf:emoji\s+attrs='(.+?)'\s*-->$/` — parse the attrs JSON, replace the pair with a single marker node consumed later; (b) a `link` node whose `url` starts with `adf://mention/` immediately followed by an `html` sibling matching `/^<!--\s*adf:mention\s+attrs='(.+?)'\s*-->$/` — same replacement. Call this new function from `processMetadataComments` (same file, ~line 371) right after `processedTree = processSpanMetadataComments(processedTree);`, before the generic comment-attachment loop. Then extend `convertMdastInlineNode`'s `'text'` and `'link'` cases in `ASTBuilder.ts` to recognize the marker this pre-pass produces and emit the corresponding `emoji`/`mention` ADF node directly.

- [ ] **Step 7: Run the tests to verify both pass**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/emoji-mention-roundtrip.test.ts`
Expected: both PASS

- [ ] **Step 8: Wire the new fixture into `adf-fixtures-integration.test.ts`**

Add `'emoji-mention-roundtrip'` to the `fixtures` array in that file's `describe('All Fixtures Validation', ...)` block (same pattern as `schema-mark-regressions`/`table-cell-whitespace` added earlier this session), so the ADF→Markdown direction and `validateAdf()` are covered too.

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 10: Build and verify explicitly**

Run: `npm run build > /tmp/build2.log 2>&1; echo "EXIT: $?"; grep -i error /tmp/build2.log`
Expected: `EXIT: 0`, no real errors.

- [ ] **Step 11: Manual before/after demo — wait for user go-ahead**

With the fix's uncommitted changes in the working tree, run the issue #20 `emoji`/`mention` repro markdown through `parser.markdownToAdf()` twice: once with the fix stashed out (`git stash`, run, print result), once restored (`git stash pop`, run, print result). Show the user both outputs — "before" should show the emoji silently missing and the mention downgraded to a plain `link` mark; "after" should show both nodes correctly reconstructed. Wait for the user's explicit go-ahead before proceeding to Step 12. Do not commit until they've confirmed.

- [ ] **Step 12: Commit**

```bash
git add tests/fixtures/adf/emoji-mention-roundtrip.adf tests/fixtures/markdown/emoji-mention-roundtrip.md \
  tests/unit/parser/emoji-mention-roundtrip.test.ts tests/integration/adf-fixtures-integration.test.ts \
  src/utils/metadata-comments.ts src/parser/markdown-to-adf/ASTBuilder.ts
git commit -m "Fix: consume emoji/mention metadata comments on round-trip (#20)"
```

- [ ] **Step 13: Push and open the PR**

```bash
git push -u origin fix/issue-20-emoji-mention-metadata
gh pr create --repo JeromeErasmus/extended-markdown-adf-parser \
  --title "[TECH] Consume emoji/mention metadata comments on round-trip" \
  --body "Fixes part of #20: markdownToAdf(adfToMarkdown(doc)) now round-trips emoji and mention nodes, which were previously silently dropped (emoji) or downgraded to a plain link mark (mention). The encoder already wrote the needed metadata comment; nothing consumed it. New dedicated pre-pass pairs the comment with its sibling directly, without touching the shared findMetadataTarget heuristic every other metadata consumer relies on.

Confirmed a real adf://mention/-shaped link with no accompanying comment still produces a plain link mark (new negative-case test).

Full suite green."
```

- [ ] **Step 14: Merge and sync local main**

```bash
gh pr merge --repo JeromeErasmus/extended-markdown-adf-parser --merge <PR_NUMBER>
git checkout main && git pull --ff-only
```

---

## Task 3: Bucket 3 — Encode-side escaping (table-cell `|`, code-block fence length)

**Files:**
- Create: `tests/fixtures/adf/table-and-codeblock-escaping.adf`
- Create: `tests/fixtures/markdown/table-and-codeblock-escaping.md`
- Create: `tests/unit/parser/table-codeblock-escaping.test.ts`
- Modify: `src/parser/adf-to-markdown/nodes/TableCellConverter.ts`
- Modify: `src/parser/adf-to-markdown/nodes/TableHeaderConverter.ts`
- Modify: `src/parser/adf-to-markdown/nodes/CodeBlockConverter.ts`

**Interfaces:**
- Consumes: nothing new from other tasks (independent of Tasks 1-2).
- Produces: no new exported functions required by other tasks — `toMarkdown` signatures on all three converters are unchanged, only their internal string-building logic changes.

- [ ] **Step 1: Create a feature branch from updated main**

```bash
git checkout main && git pull --ff-only
git checkout -b fix/issue-20-table-codeblock-escaping
```

- [ ] **Step 2: Hand-craft the fixture ADF with the issue's exact repro shapes**

Write `tests/fixtures/adf/table-and-codeblock-escaping.adf`:

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "table",
      "content": [
        {
          "type": "tableRow",
          "content": [
            { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "a|b" }] }] },
            { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "c" }] }] }
          ]
        },
        {
          "type": "tableRow",
          "content": [
            { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "1" }] }] },
            { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "2" }] }] }
          ]
        }
      ]
    },
    {
      "type": "codeBlock",
      "attrs": { "language": "js" },
      "content": [{ "type": "text", "text": "a\n```\nb" }]
    }
  ]
}
```

- [ ] **Step 3: Generate the fixture markdown from current (buggy) encode output**

Via a throwaway Jest test, run `new Parser().adfToMarkdown(adf)` on the above and write the result to `tests/fixtures/markdown/table-and-codeblock-escaping.md` as-is (this captures today's corrupted output — the unescaped `a|b` splitting the header row, and the code block closing early on the nested fence). Delete the throwaway test after.

- [ ] **Step 4: Write the failing round-trip test**

In `tests/unit/parser/table-codeblock-escaping.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

describe('Table pipe and code fence escaping (issue #20)', () => {
  it('round-trips a table cell containing a literal pipe and a code block containing a nested fence', () => {
    const parser = new Parser();
    const adf = JSON.parse(readFileSync(join(fixturesDir, 'adf/table-and-codeblock-escaping.adf'), 'utf-8'));

    const md = parser.adfToMarkdown(adf);
    const roundTripped = parser.markdownToAdf(md);

    expect(roundTripped.content).toEqual(adf.content);
  });
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/table-codeblock-escaping.test.ts`
Expected: FAIL — the table collapses to a single plain-text paragraph (pipe split the row) and/or the code block splits into a truncated block plus a stray paragraph (per the exact corruption shapes already confirmed reproducing issue #20's repro this session).

- [ ] **Step 6: Implement table-cell pipe escaping**

In both `TableCellConverter.ts` and `TableHeaderConverter.ts`, in `toMarkdown`, escape every literal `|` in the cell's converted content (`cellContent = cellContent.replace(/\|/g, '\\|')`, applied after the existing newline→`<br>` replacement) before any further processing (colspan/metadata-comment appending). No shared helper is required for two call sites this small; inline the one-line escape in each file to match the existing lack of shared converter utilities between these two near-duplicate classes.

- [ ] **Step 7: Implement code-block fence-length escaping**

In `CodeBlockConverter.ts`, before building `result`, compute the longest run of consecutive backticks in `codeContent` (e.g. via matching `` /`+/g `` and taking the max match length), and use a fence of `max(3, longestRun + 1)` backticks to wrap the content, instead of the hardcoded ` ``` `.

- [ ] **Step 8: Run the test to verify it passes**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/parser/table-codeblock-escaping.test.ts`
Expected: PASS

- [ ] **Step 9: Regenerate the fixture markdown from the now-fixed encode output**

Via a throwaway Jest test, regenerate `tests/fixtures/markdown/table-and-codeblock-escaping.md` from `adfToMarkdown()` on the same ADF — now it will contain the escaped pipe and the longer fence. Overwrite the file. Delete the throwaway test after. Re-run Step 8's test to confirm it still passes against the regenerated fixture.

- [ ] **Step 10: Add focused unit tests for the Review Focus cases**

In the same test file, add:
- `'escapes multiple pipes across header and data cells'`: a table with `|` in more than one cell (both a header and a data cell) round-trips correctly for all of them.
- `'uses more backticks than the longest run in mixed-length content'`: a codeBlock whose content contains both a 2-backtick run and a 4-backtick run produces a fence of at least 5 backticks and round-trips correctly.

- [ ] **Step 11: Wire the new fixture into `adf-fixtures-integration.test.ts`**

Add `'table-and-codeblock-escaping'` to the `fixtures` array in `describe('All Fixtures Validation', ...)`, same pattern as Task 2's Step 8.

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including every other table/codeBlock fixture already in the repo unchanged (per the design doc's confirmed zero fixture impact for this bucket).

- [ ] **Step 13: Build and verify explicitly**

Run: `npm run build > /tmp/build3.log 2>&1; echo "EXIT: $?"; grep -i error /tmp/build3.log`
Expected: `EXIT: 0`, no real errors.

- [ ] **Step 14: Manual before/after demo — wait for user go-ahead**

With the fix's uncommitted changes in the working tree, run the issue #20 table/codeBlock repro ADF through `parser.adfToMarkdown()` then `parser.markdownToAdf()` twice: once with the fix stashed out (`git stash`, run, print the corrupted markdown and the resulting mis-parsed ADF), once restored (`git stash pop`, run, print the escaped markdown and the correctly round-tripped ADF). Show the user both — "before" should show the table collapsed to one row and the code block split by the early fence close; "after" should show both correct. Wait for the user's explicit go-ahead before proceeding to Step 15. Do not commit until they've confirmed.

- [ ] **Step 15: Commit**

```bash
git add tests/fixtures/adf/table-and-codeblock-escaping.adf tests/fixtures/markdown/table-and-codeblock-escaping.md \
  tests/unit/parser/table-codeblock-escaping.test.ts tests/integration/adf-fixtures-integration.test.ts \
  src/parser/adf-to-markdown/nodes/TableCellConverter.ts src/parser/adf-to-markdown/nodes/TableHeaderConverter.ts \
  src/parser/adf-to-markdown/nodes/CodeBlockConverter.ts
git commit -m "Fix: escape table-cell pipes and code-block fence length on encode (#20)"
```

- [ ] **Step 16: Push and open the PR**

```bash
git push -u origin fix/issue-20-table-codeblock-escaping
gh pr create --repo JeromeErasmus/extended-markdown-adf-parser \
  --title "[TECH] Escape table-cell pipes and code-block fence length" \
  --body "Fixes part of #20: a literal | in a table cell no longer splits the row, and a code block whose content contains a nested \`\`\` fence no longer closes early. Both rules are unconditional/context-free (a | in a table cell is always a column delimiter; fence length is a pure function of the content's longest backtick run) — confirmed via full fixture scan that no currently-passing fixture exercises either pattern today, so this is additive with zero existing-fixture impact.

Note: plain-text escaping (headings/emphasis/links misparsing on round-trip) is a separate, larger effort - not covered here. Filing a follow-up issue.

Full suite green."
```

- [ ] **Step 17: Merge, sync local main, and file the deferred follow-up issue**

```bash
gh pr merge --repo JeromeErasmus/extended-markdown-adf-parser --merge <PR_NUMBER>
git checkout main && git pull --ff-only
gh issue create --repo JeromeErasmus/extended-markdown-adf-parser \
  --title "Plain text content misparsed as heading/emphasis/list/link syntax on round-trip" \
  --body "Follow-up from #20 (deferred, see docs/superpowers/specs/2026-11-15-issue-20-roundtrip-fidelity-design.md). Needs CommonMark-aware conditional escaping — only escape a character when it would actually be reparsed as syntax, not whenever it's merely present. A naive blind-escape approach was found to break ~190 existing lines across 4 fixtures during investigation."
```

- [ ] **Step 18: Comment on the original issue**

```bash
gh issue comment 20 --repo JeromeErasmus/extended-markdown-adf-parser --body "Fixed 6 of the 7 cases across #<PR1>, #<PR2>, #<PR3>: textColor, underline, emoji, mention, table-cell pipes, and code-block fence length all round-trip correctly now. The 7th case (plain text misparsed as heading/emphasis/list/link syntax) needs a larger, separately-scoped fix - tracked in #<FOLLOWUP_ISSUE>."
```
