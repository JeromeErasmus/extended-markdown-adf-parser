import { readdirSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../src/parser/Parser';
import type { ADFDocument } from '../../src/types/adf.types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

const findAll = (node: any, type: string, found: any[] = []): any[] => {
  if (node.type === type) found.push(node);
  for (const child of node.content || []) findAll(child, type, found);
  return found;
};

const findText = (node: any, text: string): any => {
  if (node.type === 'text' && node.text === text) return node;
  for (const child of node.content || []) {
    const found = findText(child, text);
    if (found) return found;
  }
  return null;
};

describe('Release v2.6.0: combined round-trip fidelity', () => {
  const parser = new Parser();

  it('preserves all four fixed behaviors together in one document', () => {
    const adf: ADFDocument = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'red underlined',
              marks: [{ type: 'textColor', attrs: { color: '#ff0000' } }, { type: 'underline' }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hi ' },
            { type: 'emoji', attrs: { shortName: ':smile:', text: '😄' } },
            { type: 'text', text: ' ' },
            { type: 'mention', attrs: { id: 'abc123', text: '@Jerome' } },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a|b' }] }] },
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'a\n```\nb' }],
        },
        {
          type: 'orderedList',
          attrs: { order: 5 },
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'List starting at 5' }] },
                { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested bullet item' }] }] }] },
              ],
            },
            { type: 'listItem', content: [] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item after empty' }] }] },
          ],
        },
      ],
    };

    const markdown = parser.adfToMarkdown(adf);
    const roundTripped = parser.markdownToAdf(markdown);

    // textColor/underline
    const coloredText = findText({ content: roundTripped.content }, 'red underlined');
    expect(coloredText?.marks?.map((m: any) => m.type).sort()).toEqual(['textColor', 'underline']);

    // emoji/mention
    expect(findAll({ content: roundTripped.content }, 'emoji')).toHaveLength(1);
    expect(findAll({ content: roundTripped.content }, 'mention')).toHaveLength(1);

    // table pipe escaping
    const tableNode = roundTripped.content.find((n: any) => n.type === 'table') as any;
    expect(tableNode).toBeDefined();
    expect(findText({ content: [tableNode] }, 'a|b')).toBeTruthy();

    // code fence escaping
    const codeBlockNode = roundTripped.content.find((n: any) => n.type === 'codeBlock') as any;
    expect(codeBlockNode?.content?.[0]?.text).toBe('a\n```\nb');

    // ordered list continuity (no split, nested content intact)
    const orderedLists = findAll({ content: roundTripped.content }, 'orderedList');
    expect(orderedLists).toHaveLength(1);
    expect(orderedLists[0].content).toHaveLength(3);
    expect(findAll(orderedLists[0], 'bulletList')).toHaveLength(1);
  });
});

describe('Release v2.6.0: fixture sweep (no corruption regressions)', () => {
  const parser = new Parser();
  const adfFixtureDir = join(fixturesDir, 'adf');
  const fixtureFiles = readdirSync(adfFixtureDir).filter(f => extname(f) === '.adf');

  fixtureFiles.forEach(file => {
    const name = basename(file, '.adf');

    it(`${name}: round-trip introduces no HTML-placeholder corruption or list splitting`, () => {
      const adf = JSON.parse(readFileSync(join(adfFixtureDir, file), 'utf-8'));

      let markdown: string;
      let roundTripped: ADFDocument;
      try {
        markdown = parser.adfToMarkdown(adf);
        roundTripped = parser.markdownToAdf(markdown);
      } catch (err) {
        throw new Error(`${name}: threw during round-trip: ${(err as Error).message}`);
      }

      const corruptedTextNodes = findAll({ content: roundTripped.content }, 'text').filter((n: any) =>
        typeof n.text === 'string' && n.text.startsWith('[HTML:')
      );
      expect(corruptedTextNodes).toEqual([]);

      const originalOrderedLists = findAll({ content: adf.content }, 'orderedList').length;
      const roundTrippedOrderedLists = findAll({ content: roundTripped.content }, 'orderedList').length;
      expect(roundTrippedOrderedLists).toBeLessThanOrEqual(originalOrderedLists);
    });
  });
});
