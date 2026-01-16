/**
 * @file Tests for Issue #5: Code mark exclusivity
 * @description Validates that code mark removes all other marks and that other marks cannot be added to code
 */

import { describe, it, expect } from '@jest/globals';
import { Parser } from '../../../src/parser/Parser';

describe('Code Mark Exclusivity (Issue #5)', () => {
  const parser = new Parser();

  describe('Bold + Code combinations', () => {
    it('should only have code mark when bold wraps code', () => {
      const markdown = '**`code`**';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('code');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });

    it('should not add bold mark when code mark exists', () => {
      const markdown = '`**bold code**`';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });
  });

  describe('Italic + Code combinations', () => {
    it('should only have code mark when italic wraps code', () => {
      const markdown = '*`code`*';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('code');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });

    it('should only have code mark when emphasis wraps code', () => {
      const markdown = '_`code`_';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });
  });

  describe('Strikethrough + Code combinations', () => {
    it('should only have code mark when strikethrough wraps code', () => {
      const markdown = '~~`code`~~';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });
  });

  describe('Link + Code combinations', () => {
    it('should only have code mark when link wraps code', () => {
      const markdown = '[`code`](https://example.com)';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('code');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
      // Link mark should not be added
    });
  });

  describe('Multiple marks + Code combinations', () => {
    it('should only have code mark when multiple formatting wraps code', () => {
      const markdown = '***`code`***';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('code');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });

    it('should only have code mark when bold+italic+strike wraps code', () => {
      const markdown = '~~***`code`***~~';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });
  });

  describe('Code should stand alone', () => {
    it('should preserve only code mark in simple inline code', () => {
      const markdown = '`simple code`';
      const result = parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('simple code');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('code');
    });

    it('should handle multiple code spans in same paragraph', () => {
      const markdown = '**bold** and `code` and *italic*';
      const result = parser.markdownToAdf(markdown);
      
      const content = result.content[0].content;
      
      // First should be bold
      expect(content[0].marks).toHaveLength(1);
      expect(content[0].marks[0].type).toBe('strong');
      
      // Third should be code (only)
      expect(content[2].marks).toHaveLength(1);
      expect(content[2].marks[0].type).toBe('code');
      
      // Fifth should be italic
      expect(content[4].marks).toHaveLength(1);
      expect(content[4].marks[0].type).toBe('em');
    });
  });

  describe('Edge cases', () => {
    it('should handle code at the start of bold text', () => {
      const markdown = '**`code` and bold**';
      const result = parser.markdownToAdf(markdown);
      
      const content = result.content[0].content;
      
      // First node should be code only
      expect(content[0].marks).toHaveLength(1);
      expect(content[0].marks[0].type).toBe('code');
      
      // Second node should be bold
      expect(content[1].marks).toHaveLength(1);
      expect(content[1].marks[0].type).toBe('strong');
    });

    it('should handle code at the end of italic text', () => {
      const markdown = '*italic and `code`*';
      const result = parser.markdownToAdf(markdown);
      
      const content = result.content[0].content;
      
      // First node should be italic
      expect(content[0].marks).toHaveLength(1);
      expect(content[0].marks[0].type).toBe('em');
      
      // Second node should be code only
      expect(content[1].marks).toHaveLength(1);
      expect(content[1].marks[0].type).toBe('code');
    });
  });
});
