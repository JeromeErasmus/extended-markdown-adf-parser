import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

describe('Table pipe and code fence escaping (issue #20)', () => {
  // Uses a standalone minimal doc (not the full edge-cases.adf) because that fixture's
  // header row uses colspan, which hits a separate, pre-existing bug where the
  // header/separator column-count mismatch stops the table from tokenizing at all on the
  // way back in - unrelated to pipe/fence escaping and out of scope for this task.
  it('round-trips a table cell containing a literal pipe and a code block containing a nested fence', () => {
    const parser = new Parser();
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Three' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a|b' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'd' }] }] },
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'a\n```\nb' }],
        },
      ],
    };

    const md = parser.adfToMarkdown(adf as any);
    const roundTripped = parser.markdownToAdf(md);

    expect(roundTripped.content).toEqual(adf.content);
  });

  it('encodes the extended edge-cases fixture with the pipe escaped and a longer fence', () => {
    const parser = new Parser();
    const adf = JSON.parse(readFileSync(join(fixturesDir, 'adf/edge-cases.adf'), 'utf-8'));

    const md = parser.adfToMarkdown(adf);

    // The new table row's "a|b" cell must not split into an extra column
    expect(md).toContain('a\\|b | c | d');
    // The new code block's nested ``` must not close the fence early
    expect(md).toMatch(/````js\na\n```\nb\n````/);
  });

  it('escapes multiple pipes across header and data cells', () => {
    const parser = new Parser();
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col|A' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col B' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x|y|z' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }] },
              ],
            },
          ],
        },
      ],
    };

    const md = parser.adfToMarkdown(adf as any);
    const roundTripped = parser.markdownToAdf(md);

    expect(roundTripped.content).toEqual(adf.content);
  });

  it('uses more backticks than the longest run in mixed-length content', () => {
    const parser = new Parser();
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'text' },
          content: [{ type: 'text', text: 'start ``two`` and ````four```` end' }],
        },
      ],
    };

    const md = parser.adfToMarkdown(adf as any);
    const fenceMatch = md.match(/^`{3,}/);

    expect(fenceMatch).not.toBeNull();
    expect(fenceMatch![0].length).toBeGreaterThanOrEqual(5);

    const roundTripped = parser.markdownToAdf(md);
    expect(roundTripped.content).toEqual(adf.content);
  });
});
