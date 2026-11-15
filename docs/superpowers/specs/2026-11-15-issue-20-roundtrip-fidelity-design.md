# Issue #20 round-trip fidelity — design

## Intent

Fix GitHub issue #20: `markdownToAdf(adfToMarkdown(doc))` does not preserve
the original ADF for `textColor`, `underline`, `emoji`, `mention`, `table`
(cell text containing `|`), `codeBlock` (content containing a nested code
fence), and plain `text` (content starting with `#`/`*`/`-` or containing
inline-mark-triggering characters like `*`/`_`/`` ` ``). All 7 cases from
the issue are confirmed reproducing against `main` (`5734fce`).

The README advertises bidirectional conversion with round-trip fidelity for
exactly these node/mark types, so this is a correctness bug against a
documented guarantee, not a missing feature.

## Why three separate efforts, not one

Investigation found the 7 reported cases collapse into three root causes
with very different shapes, blast radii, and risk profiles. Treating them
as one change would mean the safest fix (bucket 3) ships no faster than the
riskiest (bucket 1), and a regression in one bucket blocks review of the
other two. Each bucket below is independently specced, fixture-tested, and
landable on its own branch/PR.

## Goals

- 6 of the 7 repro cases in issue #20 round-trip correctly:
  `markdownToAdf(adfToMarkdown(doc))` produces the same marks/node
  types/text as `doc`, for `textColor`, `underline`, `emoji`, `mention`,
  `table` (cell `|`), and `codeBlock` (nested fence).
- A fixture-level regression test exists for each of those 6, in addition
  to focused unit tests.
- Zero change in output for every currently-passing fixture, except the
  specific, identified cases below where the *current* output is itself
  provably wrong and gets corrected (each one named explicitly, not
  discovered mid-implementation).

**Explicitly deferred (not a goal of this effort):** the 7th case —
plain `text` content misparsed as heading/list/emphasis/link syntax on
round-trip. Builder-check review found this needs CommonMark-aware
conditional escaping (only escape a character when it would *actually*
be reparsed as syntax, not whenever it's merely present), which is a
meaningfully larger, separately-scoped effort — see Bucket 3 below. File
a follow-up issue referencing this when bucket 3 ships, so it isn't
lost.

## Non-goals

- General-purpose arbitrary-HTML-in-markdown support. Bucket 1 recognizes
  exactly the two patterns this library itself emits (`<span
  style="color: ...">...</span>`, `<u>...</u>`); it is not a generic HTML
  parser.
- Fixing round-trip fidelity for node/mark types not named in issue #20 or
  not covered by the README's round-trip claim.
- Changing the on-the-wire Markdown representation (the encoded form) for
  any type not touched by one of the three buckets.

## Anti-goals (would make this a failure even if cases pass)

- Any existing fixture's *ADF→Markdown* direction silently changes output
  for content that wasn't part of the bug (e.g. escaping something that
  didn't need it, or over-matching HTML tags this library didn't write).
- A fix that only works for the exact literal strings in the issue's repro
  but breaks on trivial variations (nested tags, multiple cells with `|`,
  a code block containing a fence of a different length).
- Silent, uncaught regressions: every bucket ships with the full existing
  suite green, not just its own new tests.

## Constraints

- No regressions (explicit, repeated user requirement). Full suite +
  fixture suites must stay green after each bucket.
- Fixtures: create new ones, or update existing ones *only* where this
  investigation has already identified a specific, named line that is
  currently wrong and will change. No speculative/bulk fixture
  regeneration.
- Order per bucket: write the fixture test that replicates the bug first
  (confirm it fails against current code), then implement the fix, then
  it passes, plus new unit tests.
- Three independent PRs/branches, same workflow as the prior 8 PRs this
  session (branch → fix → build/test green → merge).

---

## Bucket 1 — Mark-as-HTML decoding (`textColor`, `underline`)

**Root cause:** `TextColorConverter`/`UnderlineConverter` emit `<span
style="color:X">...</span>` / `<u>...</u>`. Remark tokenizes raw inline
HTML as flat, unpaired `html` nodes — confirmed via direct mdast
inspection: `<span style="color: #ff0000">red</span>` parses to three
*sibling* nodes in the same paragraph: `html("<span ...>")`,
`text("red")`, `html("</span>")`. Nothing in `ASTBuilder` pairs these up;
they fall through to the generic `[HTML: ...]` placeholder fallback.

**Fix:** a new pairing pass over a container's inline children (run before
the existing `convertMdastInlineNode` switch) that:
1. Scans for an opening `html` node matching `<span style="color:\s*(#?[0-9a-fA-F]{3,8}|\w+)">` or exactly `<u>`.
2. Finds the next sibling `html` node that's the matching close tag
   (`</span>` / `</u>`) at the same list level (no nesting tracking needed
   beyond matching the next same-type close, since these two patterns
   never self-nest in content we emit).
3. Converts everything between (inclusive of further nested marks, e.g. a
   `<u>` inside a `<span>`) into a marked text run via the existing
   `wrapWithMark`/`addMarkWithCodeExclusivity` machinery, recursing so
   nested span/u pairs compose correctly.
4. Anything that doesn't match either pattern is left as today's `[HTML:
   ...]` fallback — unchanged behavior for genuine arbitrary HTML.

**Regression risk: low.** Purely additive — a new recognized case in a
`switch`/pre-pass, only triggered by the two specific tag shapes this
library's own encoder emits. Untouched by anything else today.

**Already-correct target to verify against:** `tests/fixtures/adf/comprehensive-marks.adf`
already contains the *correct* structure for this exact scenario — verified
by direct inspection: its committed `.adf` has `textColor`, `underline`,
and a combined `link+strong+underline` mark, all correct. The
`adf-fixtures-integration.test.ts` round-trip test (ADF→Markdown direction)
is already green for this fixture; it's the `markdownToAdf` direction that
was never checked. This bucket's work is: make `markdownToAdf(comprehensive-marks.md)`
reproduce those same marks — no `.adf` fixture changes needed, just a new
test assertion against an existing, already-correct file.

**Step 0 — replicate first (red):** add a new test (new file,
`tests/unit/parser/mark-as-html-roundtrip.test.ts`) that:
1. Reads `tests/fixtures/markdown/comprehensive-marks.md` and runs it
   through `new Parser().markdownToAdf(...)`.
2. Asserts the resulting text nodes carry `textColor`/`underline` marks
   matching the corresponding nodes in the already-committed
   `tests/fixtures/adf/comprehensive-marks.adf` (the same nodes listed
   above: `"underlined text"`, `"colored text"`, `"bold underlined link"`,
   `"hex color"`, `"RGB color"`, `"named color"`).
3. Run it and confirm it fails against current code (producing the
   `[HTML: ...]` placeholder instead of the mark) — this is the
   replication of issue #20's `textColor`/`underline` cases, using the
   library's own existing fixture content, before any fix lands.

**Estimated size:** ~60-100 lines (one new private method in `ASTBuilder.ts`
plus its call site(s) in both the token and mdast inline-conversion paths,
matching the dual-path pattern established by the #6 and #10 fixes this
session) + ~40-60 lines of new unit tests + 1 new fixture-level assertion
against the existing `comprehensive-marks` fixture.

---

## Bucket 2 — Metadata comment written but never consumed (`emoji`, `mention`)

**Root cause:** Encoders already emit the needed data —
`<!-- adf:emoji attrs='{"shortName":":smile:","text":"😄"}' -->` and
`<!-- adf:mention attrs='{"id":"abc","text":"@abc"}' -->` — and
`isAdfMetadataComment()` already recognizes both as valid metadata (they're
not in the excluded `processingDirectives` list). But the only place that
*reads* an attached metadata comment on a text node
(`convertMdastInlineNode`'s `'text'` case) only looks for a `metadata.marks`
key — never a `nodeType: 'emoji'`/`'mention'` to reconstruct a node. The
comment is silently discarded as inert documentation.

**Builder-check correction:** the originally-planned fix location (reading
`node.data.adfMetadata` on the text/link node in `convertMdastInlineNode`)
does not work. Verified by instrumentation: `findMetadataTarget` attaches
both the emoji and mention trailing comments to the *enclosing paragraph*
(Strategy 1: `parent.type === 'paragraph' → return parent`), not to the
specific text/link sibling, because that strategy fires unconditionally
whenever the comment's immediate parent is a paragraph — regardless of
whether other siblings (surrounding text, the link/emoji itself) are
present. The media/mediaSingle precedent this was based on works via a
*different*, narrower mechanism (`convertMdastParagraph`'s single-image-child
special case) that only applies when the paragraph has exactly one child;
emoji/mention paragraphs typically have more.

**Fix (decided): dedicated pre-pass.** Add a new tree-visiting pass,
architecturally alongside the existing `processSpanMetadataComments`
(i.e. it bypasses `findMetadataTarget` entirely, the same way that
function does for its own span-comment format), run at the same
preprocessing stage. It specifically recognizes:
- A text node immediately followed by an `html` sibling matching
  `<!-- adf:emoji attrs='{...}' -->` → replace the pair with a single
  node carrying the emoji metadata, consumed by `convertMdastInlineNode`
  to emit an `emoji` ADF node.
- A `link` node (whose `url` matches `adf://mention/...`) immediately
  followed by an `html` sibling matching `<!-- adf:mention attrs='{...}' -->`
  → replace the pair similarly, consumed to emit a `mention` ADF node
  instead of falling through to the generic link-parsing path.

This bypass means the generic `[text](adf://mention/id)`-as-link
misparse never gets a chance to run for a *correctly-annotated* mention —
no race or ordering dependency on the existing link-token path, and no
change to `findMetadataTarget` or any other metadata consumer.

**Regression risk: low.** Fully isolated new pass; does not touch
`findMetadataTarget` or any other code path other metadata consumers
(paragraph/heading/table-cell/panel/expand attrs) rely on. A real link
that happens to use the `adf://mention/` scheme *without* a following
`adf:mention` comment is unaffected — the pre-pass only fires when both
the link and the specific trailing comment are present together. One
explicit negative-case unit test (a `adf://mention/`-style link with no
comment still produces a plain `link` mark) covers this; no existing
fixture currently emits such a link without the comment, so no existing
fixture changes expected.

**Step 0 — replicate first (red):** add a new fixture pair,
`tests/fixtures/adf/emoji-mention-roundtrip.adf` /
`tests/fixtures/markdown/emoji-mention-roundtrip.md`, built the same way
as this session's `schema-mark-regressions` fixture:
1. Hand-craft the ADF: a paragraph with an `emoji` node and a `mention`
   node (plus some surrounding plain text, since the bug specifically
   requires other paragraph children for `findMetadataTarget`'s Strategy
   1 to misfire — a single-child paragraph wouldn't exercise the bug).
2. Generate the `.md` from the *current* `adfToMarkdown()` (the encode
   direction isn't broken, so this is safe to generate now and won't
   need to change once the fix lands).
3. Add a new test (`tests/unit/parser/emoji-mention-roundtrip.test.ts`)
   that runs `markdownToAdf()` on that generated `.md` and asserts the
   result reproduces the original hand-crafted ADF's `emoji`/`mention`
   nodes.
4. Run it and confirm it fails against current code (emoji silently
   dropped, mention downgraded to a plain `link` mark) — this is the
   replication of issue #20's `emoji`/`mention` cases.

**Estimated size:** ~70-110 lines (new pre-pass function in
`metadata-comments.ts`, its call site in the preprocessing pipeline
alongside `processSpanMetadataComments`, plus the two new emoji/mention
branches in `convertMdastInlineNode` that consume the paired node) +
~40-60 lines of new unit tests (including the negative case) + no
existing fixture changes expected — new fixture pair needed.

---

## Bucket 3 — Missing escaping on ADF→Markdown encode (`table` cells, `codeBlock` nested fences only — rescoped)

**Root cause (table cells):** `TableCellConverter`/`TableHeaderConverter`
emit a literal `|` in cell text raw, which GFM table parsing reads as an
extra column boundary, corrupting the row. Confirmed: no existing
committed fixture currently has a `|` inside a table cell, so no fixture
content is affected by adding escaping here — this rule is unconditional
and context-free (a `|` inside a table cell is *always* a column
delimiter in GFM, no flanking/conditional logic needed).

**Root cause (code blocks):** `CodeBlockConverter` interpolates code
content directly between ` ``` ` fences with no check for whether the
content itself contains a same-or-longer backtick run, which prematurely
closes the fence. Confirmed: no existing fixture's codeBlock content
contains a backtick fence; the one `` ``` `` match found in fixtures is
an unrelated, pre-existing oddity in a `language` attribute value, not in
code content. This rule is also unconditional (fence length is a pure
function of the longest backtick run in the content).

**Rescoped — removed from this bucket (builder-check finding):**
escaping plain `text` content (leading `#`/`*`/`-`/`_`, inline
`*`/`_`/`` ` ``/`[`/`]`) is **out of scope for this effort.** Builder
check scanned inline (not just leading) occurrences across all fixtures
and found ~190 matches across 4 fixtures (`comprehensive-advanced-features`,
`comprehensive-mentions-and-social`, `comprehensive-status-and-dates`,
`edge-cases`) — mostly literal bracket/status text like `[Complete]`,
`[x]`, `5 * 3 = 15` — and confirmed via direct remark parsing that none
of these are actually ambiguous today (CommonMark only treats
`[`/`*`/`_` as syntax under specific flanking/follow-up conditions, not
by presence alone). A correct fix needs CommonMark-aware conditional
escaping (escape only when the character would *actually* be reparsed),
which is a meaningfully larger, separately-scoped effort. Tracked as a
follow-up, not part of this bucket's goals.

**Known, named fixture impact (confirmed by direct inspection, not
speculative):** none. The one previously-identified line
(`comprehensive-advanced-features.md` line 505, `**Core Features**` in a
table cell) only needed updating under the now-removed plain-text
escaping rule — a literal `**` is not a `|`, so the table-cell-pipe-only
rule in this rescoped bucket does not touch it. **No existing fixture
line requires updating for the rescoped bucket 3.**

**Fix:** add a small escaping helper scoped specifically to table-cell
content (escape `|` only — unconditional, context-free), and a
fence-length rule in `CodeBlockConverter`: if the content contains a
backtick run of length N, the wrapping fence must use more than N
backticks (standard CommonMark-compatible approach) rather than
character-escaping (code content must stay literal).

**Regression risk: low.** Both rules are unconditional and context-free
(no flanking-rule logic needed, unlike the deferred text-escaping case),
and the fixture scan confirms zero currently-passing fixtures exercise
either pattern today.

**Step 0 — replicate first (red):** add a new fixture pair,
`tests/fixtures/adf/table-and-codeblock-escaping.adf` /
`tests/fixtures/markdown/table-and-codeblock-escaping.md`:
1. Hand-craft the ADF: a table with a cell whose text contains a literal
   `|` (e.g. `"a|b"`, matching the issue's repro), and a `codeBlock`
   whose content contains a nested ` ``` ` fence (matching the issue's
   repro).
2. Generate the `.md` from the *current* (buggy) `adfToMarkdown()` output
   — this is the actual corrupted markdown the bug produces (unescaped
   pipe splitting the row, fence closing early), which is exactly what
   needs to change once the fix lands, so commit it as-is for now.
3. Add a new test (`tests/unit/nodes/TableCellConverter.escaping.test.ts`
   and/or a shared `tests/unit/parser/table-codeblock-escaping.test.ts`)
   that runs `markdownToAdf()` on the generated `.md` and asserts the
   result does *not* reproduce the original table/codeBlock structure
   (corrupted row count / split code block) — proving today's output is
   broken.
4. Run it and confirm it's red against current code before implementing
   the fix. Once the fix lands, regenerate this fixture's `.md` from the
   *fixed* `adfToMarkdown()` output (now correctly escaped) and flip the
   test to assert correct round-trip instead.

**Estimated size:** ~30-50 lines (table-cell `|` escaping + code-block
fence-length logic, two narrow call sites) + ~30-40 lines of new unit
tests (table pipe escaping, code fence length at several backtick-run
lengths) + no existing fixture changes + new fixture scenario(s) covering
both rules.

---

## Risk/size summary

| Bucket | Regression risk | New code (rough) | Fixture impact |
|---|---|---|---|
| 1. Mark-as-HTML (`textColor`, `underline`) | Low — purely additive | ~100-160 lines incl. tests | None required; new assertion against already-correct `comprehensive-marks` |
| 2. Metadata consumption (`emoji`, `mention`), dedicated pre-pass | Low — fully isolated new pass, doesn't touch shared `findMetadataTarget` | ~110-170 lines incl. tests | None required; new fixture pair |
| 3. Escaping on encode (table `\|` + code fence length *only*) | Low — both rules unconditional/context-free, confirmed zero fixtures affected | ~60-90 lines incl. tests | None required; new fixtures |

Plain-text escaping (headings/emphasis/links misparse — the issue's 7th
case) is explicitly **out of scope**, deferred to a follow-up issue filed
once this effort ships.

Recommended order: **1 → 2 → 3**, lowest-risk first, each merged and
verified green before starting the next — consistent with how the prior 8
PRs in this session were handled individually.

## What's left to the builder

- Exact regex/matching rules for bucket 1's tag recognition (case
  sensitivity of hex colors, whitespace tolerance in the `style` attr).
- Exact implementation of bucket 2's pre-pass matching regex/logic for
  pairing the trailing `adf:emoji`/`adf:mention` comment with its
  preceding sibling (mirroring `processSpanMetadataComments`'s approach
  of bypassing `findMetadataTarget`, but matching this bucket's specific
  trailing-comment shape rather than that function's wrapping-pair
  shape).
- Exact location/signature of bucket 3's table-cell `|`-escaping helper
  and code-block fence-length logic (inline in each converter, or a
  small shared utility — builder's call, matching existing codebase
  conventions).
- Whether bucket 3's code-fence-length rule needs to handle a
  pathological case (content containing *only* backtick runs) — note it,
  decide inline during implementation, don't block the plan on it.
- Precise new fixture file names/content for bucket 2's emoji/mention
  pair and bucket 3's escaping scenarios (follow the pattern established
  by `schema-mark-regressions`/`table-mark-exclusivity` from this
  session: hand-craft the ADF, generate the `.md` from the *fixed* real
  converter output, not hand-guessed).
- Filing the follow-up issue for deferred plain-text escaping, once
  buckets 1-3 are merged.
