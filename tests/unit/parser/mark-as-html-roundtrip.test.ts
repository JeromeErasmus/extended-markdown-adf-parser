import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../../src/parser/Parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures');

const findText = (node: any, text: string): any => {
  if (node.type === 'text' && node.text === text) return node;
  for (const child of node.content || []) {
    const found = findText(child, text);
    if (found) return found;
  }
  return null;
};

// Mark array order isn't semantically meaningful in ADF, so compare as sets.
const sortMarks = (marks: any[] | undefined) => [...(marks || [])].sort((a, b) => a.type.localeCompare(b.type));

describe('Mark-as-HTML round-trip', () => {
  it('reproduces comprehensive-marks.adf textColor/underline marks from its own .md', () => {
    const parser = new Parser();
    const markdown = readFileSync(join(fixturesDir, 'markdown/comprehensive-marks.md'), 'utf-8');
    const expectedAdf = JSON.parse(readFileSync(join(fixturesDir, 'adf/comprehensive-marks.adf'), 'utf-8'));

    const result = parser.markdownToAdf(markdown);

    for (const text of ['underlined text', 'colored text', 'bold underlined link', 'hex color', 'RGB color', 'named color']) {
      const expected = findText({ content: expectedAdf.content }, text);
      const actual = findText({ content: result.content }, text);
      expect(sortMarks(actual?.marks)).toEqual(sortMarks(expected?.marks));
    }
  });

  it('wraps nested <u> inside <span style="color:...">', () => {
    const parser = new Parser();
    const result = parser.markdownToAdf('<span style="color: #ff0000"><u>x</u></span>');

    const textNode = findText({ content: result.content }, 'x');
    expect(textNode?.marks).toEqual([
      { type: 'underline' },
      { type: 'textColor', attrs: { color: '#ff0000' } }
    ]);
  });

  it('leaves unrecognized HTML as the existing placeholder', () => {
    const parser = new Parser();
    // Prefixed with text so remark tokenizes <div> as inline HTML rather than a block (out of scope here).
    const result = parser.markdownToAdf('before <div>x</div> after');

    expect(findText({ content: result.content }, '[HTML: <div>]')).toBeTruthy();
    expect(findText({ content: result.content }, '[HTML: </div>]')).toBeTruthy();
  });

  it('leaves an unclosed <span> as the existing placeholder', () => {
    const parser = new Parser();
    const result = parser.markdownToAdf('<span style="color: #ff0000">x');

    expect(findText({ content: result.content }, '[HTML: <span style="color: #ff0000">]')).toBeTruthy();
    expect(findText({ content: result.content }, 'x')).toBeTruthy();
  });

  it('decodes textColor/underline marks inside a table cell (not just paragraphs)', () => {
    const parser = new Parser();
    const markdown = readFileSync(join(fixturesDir, 'markdown/table-document.md'), 'utf-8');
    const result = parser.markdownToAdf(markdown);

    const complete = findText({ content: result.content }, 'Complete');
    expect(sortMarks(complete?.marks)).toEqual(sortMarks([{ type: 'textColor', attrs: { color: '#36B37E' } }]));

    const npmPublish = findText({ content: result.content }, 'npm publish');
    expect(sortMarks(npmPublish?.marks)).toEqual(sortMarks([{ type: 'underline' }]));
  });
});
