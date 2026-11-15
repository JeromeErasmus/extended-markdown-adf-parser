import { Parser } from '../../../src/parser/Parser';

describe('Ordered list nested-content indentation', () => {
  const parser = new Parser();

  it('keeps nested content attached to a single-digit ordered item', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { order: 5 },
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Parent item' }] },
                { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested' }] }] }] },
              ],
            },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Next item' }] }] },
          ],
        },
      ],
    };

    const markdown = parser.adfToMarkdown(adf as any);
    const roundTripped = parser.markdownToAdf(markdown);

    expect(roundTripped.content).toHaveLength(1);
    expect(roundTripped.content[0].type).toBe('orderedList');
    expect(roundTripped.content[0].content).toHaveLength(2);
  });

  it('keeps nested content attached to a double-digit ordered item', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { order: 10 },
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Parent item' }] },
                { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested' }] }] }] },
              ],
            },
          ],
        },
      ],
    };

    const markdown = parser.adfToMarkdown(adf as any);
    const roundTripped = parser.markdownToAdf(markdown);

    expect(roundTripped.content).toHaveLength(1);
    expect(roundTripped.content[0].type).toBe('orderedList');
  });

  it('still round-trips a flat ordered list with an empty item (no nested content)', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { order: 1 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }] },
          ],
        },
      ],
    };

    const markdown = parser.adfToMarkdown(adf as any);
    const roundTripped = parser.markdownToAdf(markdown);

    expect(roundTripped.content).toHaveLength(1);
    expect(roundTripped.content[0].content).toHaveLength(3);
  });

  it('does not widen a nested bullet list inside an ordered item', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { order: 1 },
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
                { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] }] },
              ],
            },
          ],
        },
      ],
    };

    const markdown = parser.adfToMarkdown(adf as any);
    expect(markdown).toContain('\n   - Child');
  });
});
