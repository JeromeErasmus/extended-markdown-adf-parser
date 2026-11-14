/**
 * @file Tests for whitespace-only table cells (regression for #7)
 * @description cleanupEmptyParagraphs must not strip a table cell's only
 * paragraph just because its text is whitespace-only (e.g. NBSP from
 * pasted content) - doing so reopens Jira's INVALID_INPUT rejection.
 */

import { describe, it, expect } from '@jest/globals';
import { Parser } from '../../../src/parser/Parser';

describe('Whitespace-only table cells', () => {
  const parser = new Parser();

  it('should keep a non-empty paragraph in a cell containing only an NBSP', () => {
    const nbsp = ' ';
    const markdown = `| A | B |\n|---|---|\n| x | ${nbsp} |\n`;
    const adf = parser.markdownToAdf(markdown);

    const cell = adf.content[0].content[1].content[1];
    expect(cell.content).toHaveLength(1);
    expect(cell.content[0].type).toBe('paragraph');
    expect(cell.content[0].content).toHaveLength(1);

    const validation = parser.validateAdf(adf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should still remove a stray whitespace-only paragraph outside a table cell', () => {
    const markdown = 'Real paragraph.\n\n \n\nAnother real paragraph.\n';
    const adf = parser.markdownToAdf(markdown);

    expect(adf.content.map(n => n.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('should leave a genuinely empty cell (or a plain-ASCII-space cell, trimmed upstream) as an empty paragraph', () => {
    const markdown = '| A | B |\n|---|---|\n| x | |\n';
    const adf = parser.markdownToAdf(markdown);

    const cell = adf.content[0].content[1].content[1];
    expect(cell.content).toEqual([{ type: 'paragraph', content: [] }]);

    const validation = parser.validateAdf(adf);
    expect(validation.valid).toBe(true);
  });
});
