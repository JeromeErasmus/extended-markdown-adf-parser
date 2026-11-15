import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

describe('Emoji/mention metadata round-trip (issue #20)', () => {
  it('reproduces modern-elements.adf emoji/mention nodes from their encoded markdown', () => {
    const parser = new Parser();
    const markdown = readFileSync(join(fixturesDir, 'markdown/modern-elements.md'), 'utf-8');
    const expectedAdf = JSON.parse(readFileSync(join(fixturesDir, 'adf/modern-elements.adf'), 'utf-8'));

    const result = parser.markdownToAdf(markdown);

    const findAll = (node: any, type: string, found: any[] = []): any[] => {
      if (node.type === type) found.push(node);
      for (const child of node.content || []) findAll(child, type, found);
      return found;
    };

    expect(findAll({ content: result.content }, 'emoji')).toEqual(findAll({ content: expectedAdf.content }, 'emoji'));
    expect(findAll({ content: result.content }, 'mention')).toEqual(findAll({ content: expectedAdf.content }, 'mention'));
  });

  it('does not misfire on a real adf://mention/-shaped link with no comment', () => {
    const parser = new Parser();
    const result = parser.markdownToAdf('[@abc](adf://mention/abc)');
    const textNode = result.content[0].content[0];
    expect(textNode.marks).toEqual([{ type: 'link', attrs: { href: 'adf://mention/abc' } }]);
  });

  it('preserves the full leading text when the emoji comment attrs do not match a suffix of the text (no silent data loss)', () => {
    const parser = new Parser();
    // attrs' text ("🙈") is not a suffix of the preceding text node's value ("Hello world"),
    // simulating mismatched/stale attrs on the comment.
    const markdown = 'Hello world<!-- adf:emoji attrs=\'{"shortName":":bogus:","text":"🙈"}\' -->';

    const result = parser.markdownToAdf(markdown);
    const paragraph = result.content[0];

    expect(paragraph.content.some((n: any) => n.type === 'emoji')).toBe(false);
    const textContent = paragraph.content.map((n: any) => n.text ?? '').join('');
    expect(textContent).toBe('Hello world');
  });
});
