/**
 * @file MarkdownTokenizer.task-list.test.ts
 * @description Tests for MarkdownTokenizer checkbox/task-list detection in parseListItem
 */

import { MarkdownTokenizer } from '../../../src/parser/markdown-to-adf/MarkdownTokenizer.js';
import type { ListItemToken } from '../../../src/parser/markdown-to-adf/types.js';

describe('MarkdownTokenizer - Task List / Checkbox Detection', () => {
  let tokenizer: MarkdownTokenizer;

  beforeEach(() => {
    tokenizer = new MarkdownTokenizer();
  });

  describe('Checkbox detection in list items', () => {
    it('should detect checked checkbox: "- [x] Done task"', () => {
      const tokens = tokenizer.tokenize('- [x] Done task');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('list');

      const listItems = tokens[0].children;
      expect(listItems).toBeDefined();
      expect(listItems).toHaveLength(1);

      const item = listItems![0] as ListItemToken;
      expect(item.type).toBe('listItem');
      expect(item.checked).toBe(true);
      // Content should have the checkbox prefix stripped
      expect(item.content).not.toMatch(/^\[x\]/);
      expect(item.content).toContain('Done task');
    });

    it('should detect unchecked checkbox: "- [ ] Pending task"', () => {
      const tokens = tokenizer.tokenize('- [ ] Pending task');

      expect(tokens).toHaveLength(1);
      const listItems = tokens[0].children;
      expect(listItems).toHaveLength(1);

      const item = listItems![0] as ListItemToken;
      expect(item.type).toBe('listItem');
      expect(item.checked).toBe(false);
      expect(item.content).not.toMatch(/^\[ \]/);
      expect(item.content).toContain('Pending task');
    });

    it('should detect uppercase X checkbox: "- [X] Done"', () => {
      const tokens = tokenizer.tokenize('- [X] Done');

      expect(tokens).toHaveLength(1);
      const item = tokens[0].children![0] as ListItemToken;
      expect(item.type).toBe('listItem');
      expect(item.checked).toBe(true);
      expect(item.content).toContain('Done');
    });

    it('should NOT set checked property on regular list items', () => {
      const tokens = tokenizer.tokenize('- Normal item');

      expect(tokens).toHaveLength(1);
      const item = tokens[0].children![0] as ListItemToken;
      expect(item.type).toBe('listItem');
      expect(item.checked).toBeUndefined();
      expect(item.content).toContain('Normal item');
    });

    it('should handle mixed list with checkbox and regular items', () => {
      const markdown = '- [x] Checked\n- Regular\n- [ ] Unchecked';
      const tokens = tokenizer.tokenize(markdown);

      expect(tokens).toHaveLength(1);
      const items = tokens[0].children!;
      expect(items).toHaveLength(3);

      expect((items[0] as ListItemToken).checked).toBe(true);
      expect((items[1] as ListItemToken).checked).toBeUndefined();
      expect((items[2] as ListItemToken).checked).toBe(false);
    });

    it('should strip checkbox prefix from content text', () => {
      const tokens = tokenizer.tokenize('- [x] Task text here');

      const item = tokens[0].children![0] as ListItemToken;
      // The content field should contain the text without the [x] prefix
      expect(item.content).toBe('Task text here');
    });

    it('should strip unchecked checkbox prefix from content text', () => {
      const tokens = tokenizer.tokenize('- [ ] Another task');

      const item = tokens[0].children![0] as ListItemToken;
      expect(item.content).toBe('Another task');
    });
  });

  describe('Token type remains listItem', () => {
    it('should produce listItem tokens regardless of checkbox state', () => {
      const markdown = '- [x] Done\n- [ ] Todo\n- Normal';
      const tokens = tokenizer.tokenize(markdown);

      const items = tokens[0].children!;
      for (const item of items) {
        expect(item.type).toBe('listItem');
      }
    });
  });

  describe('List-level token type', () => {
    it('should produce a list token for checkbox lists', () => {
      const tokens = tokenizer.tokenize('- [x] Task');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('list');
      expect((tokens[0] as any).ordered).toBe(false);
    });
  });
});
