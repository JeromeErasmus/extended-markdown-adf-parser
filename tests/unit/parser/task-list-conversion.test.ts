/**
 * @file Integration tests for task list conversion (MD <-> ADF)
 * Tests both markdown-to-ADF and ADF-to-markdown conversion paths
 * using the Parser class directly.
 */

import { describe, it, expect } from '@jest/globals';
import { Parser } from '../../../src/parser/Parser';
import type { ADFDocument, TaskListNode, TaskItemNode } from '../../../src/types';

describe('Task List Conversion', () => {
  const parser = new Parser();

  describe('Markdown to ADF', () => {
    it('should convert "- [x] Done" to taskList with taskItem state=DONE', () => {
      const markdown = '- [x] Done';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.type).toBe('doc');
      expect(adf.content).toHaveLength(1);

      const taskList = adf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.attrs).toBeDefined();
      expect(taskList.attrs.localId).toBeDefined();
      expect(taskList.content).toHaveLength(1);

      const taskItem = taskList.content[0] as TaskItemNode;
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs.state).toBe('DONE');
      expect(taskItem.attrs.localId).toBeDefined();

      // taskItem content should contain inline text node with "Done"
      expect(taskItem.content).toBeDefined();
      expect(taskItem.content!.length).toBeGreaterThanOrEqual(1);
      const textNode = taskItem.content!.find(n => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode!.text).toBe('Done');
    });

    it('should convert "- [ ] Todo" to taskList with taskItem state=TODO', () => {
      const markdown = '- [ ] Todo';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content).toHaveLength(1);

      const taskList = adf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(1);

      const taskItem = taskList.content[0] as TaskItemNode;
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs.state).toBe('TODO');

      const textNode = taskItem.content!.find(n => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode!.text).toBe('Todo');
    });

    it('should convert mixed checkbox list to single taskList with mixed states', () => {
      const markdown = '- [x] Completed\n- [ ] Pending\n- [x] Also done';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content).toHaveLength(1);

      const taskList = adf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(3);

      expect(taskList.content[0].attrs.state).toBe('DONE');
      expect(taskList.content[1].attrs.state).toBe('TODO');
      expect(taskList.content[2].attrs.state).toBe('DONE');
    });

    it('should keep regular bullet list (no checkboxes) as bulletList', () => {
      const markdown = '- First item\n- Second item';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content).toHaveLength(1);
      expect(adf.content[0].type).toBe('bulletList');
    });

    it('should handle task items with inline formatting (bold, code)', () => {
      const markdown = '- [x] **Bold task** with `code`';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content).toHaveLength(1);

      const taskList = adf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(1);

      const taskItem = taskList.content[0] as TaskItemNode;
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs.state).toBe('DONE');

      // Inline formatting should be preserved in content
      expect(taskItem.content).toBeDefined();
      expect(taskItem.content!.length).toBeGreaterThanOrEqual(1);

      // Should have text nodes with marks for bold and code
      const boldNode = taskItem.content!.find(
        n => n.type === 'text' && n.marks?.some(m => m.type === 'strong')
      );
      expect(boldNode).toBeDefined();
    });

    it('should generate localId attrs on taskList and each taskItem', () => {
      const markdown = '- [x] Task 1\n- [ ] Task 2';
      const adf = parser.markdownToAdf(markdown);

      const taskList = adf.content[0] as TaskListNode;
      expect(typeof taskList.attrs.localId).toBe('string');
      expect(taskList.attrs.localId.length).toBeGreaterThan(0);

      for (const item of taskList.content) {
        expect(typeof item.attrs.localId).toBe('string');
        expect(item.attrs.localId.length).toBeGreaterThan(0);
      }

      // Each localId should be unique
      const ids = [taskList.attrs.localId, ...taskList.content.map(i => i.attrs.localId)];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('taskItem content should be inline nodes, NOT wrapped in paragraph', () => {
      const markdown = '- [x] Simple text';
      const adf = parser.markdownToAdf(markdown);

      const taskList = adf.content[0] as TaskListNode;
      const taskItem = taskList.content[0] as TaskItemNode;

      // Content should NOT be wrapped in a paragraph
      expect(taskItem.content).toBeDefined();
      const hasParagraph = taskItem.content!.some(n => n.type === 'paragraph');
      expect(hasParagraph).toBe(false);

      // Should have inline text node directly
      const textNode = taskItem.content!.find(n => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode!.text).toBe('Simple text');
    });
  });

  describe('Edge Cases: Complex Checkbox Items', () => {
    it('should fall back to bulletList when any checkbox item has multiple paragraphs', () => {
      const markdown = '- [x] Simple task\n- [ ] Complex task\n\n  Second paragraph';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content.length).toBeGreaterThanOrEqual(1);
      // The entire list should fall back to bulletList since second item has multiple paragraphs
      const listNode = adf.content[0];
      expect(listNode.type).toBe('bulletList');
    });

    it('should fall back to bulletList when any checkbox item has nested sub-lists', () => {
      const markdown = '- [x] Task with sub-list\n  - nested item\n- [ ] Simple task';
      const adf = parser.markdownToAdf(markdown);

      expect(adf.content.length).toBeGreaterThanOrEqual(1);
      // Should fall back to bulletList since first item has nested list
      const listNode = adf.content[0];
      expect(listNode.type).toBe('bulletList');
    });

    it('should still convert simple checkbox items correctly', () => {
      const markdown = '- [x] Simple task 1\n- [ ] Simple task 2';
      const adf = parser.markdownToAdf(markdown);

      const taskList = adf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(2);
      expect(taskList.content[0].type).toBe('taskItem');
      expect(taskList.content[1].type).toBe('taskItem');
    });
  });

  describe('ADF to Markdown', () => {
    it('should convert taskList/taskItem DONE to "- [x] text"', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'taskList',
            attrs: { localId: 'list-1' },
            content: [
              {
                type: 'taskItem',
                attrs: { localId: 'item-1', state: 'DONE' },
                content: [{ type: 'text', text: 'Completed task' }]
              }
            ]
          }
        ]
      };

      const markdown = parser.adfToMarkdown(adf);
      expect(markdown).toContain('- [x] Completed task');
    });

    it('should convert taskList/taskItem TODO to "- [ ] text"', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'taskList',
            attrs: { localId: 'list-1' },
            content: [
              {
                type: 'taskItem',
                attrs: { localId: 'item-1', state: 'TODO' },
                content: [{ type: 'text', text: 'Pending task' }]
              }
            ]
          }
        ]
      };

      const markdown = parser.adfToMarkdown(adf);
      expect(markdown).toContain('- [ ] Pending task');
    });

    it('should convert mixed state taskList correctly', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'taskList',
            attrs: { localId: 'list-1' },
            content: [
              {
                type: 'taskItem',
                attrs: { localId: 'item-1', state: 'DONE' },
                content: [{ type: 'text', text: 'Done' }]
              },
              {
                type: 'taskItem',
                attrs: { localId: 'item-2', state: 'TODO' },
                content: [{ type: 'text', text: 'Todo' }]
              },
              {
                type: 'taskItem',
                attrs: { localId: 'item-3', state: 'DONE' },
                content: [{ type: 'text', text: 'Also done' }]
              }
            ]
          }
        ]
      };

      const markdown = parser.adfToMarkdown(adf);
      expect(markdown).toContain('- [x] Done');
      expect(markdown).toContain('- [ ] Todo');
      expect(markdown).toContain('- [x] Also done');
    });
  });

  describe('Round-trip', () => {
    it('MD -> ADF -> MD should preserve checkbox state', () => {
      const originalMd = '- [x] Completed\n- [ ] Pending';
      const adf = parser.markdownToAdf(originalMd);
      const roundTripMd = parser.adfToMarkdown(adf);

      // Should preserve the checked/unchecked state
      expect(roundTripMd).toContain('- [x] Completed');
      expect(roundTripMd).toContain('- [ ] Pending');
    });

    it('ADF -> MD -> ADF should preserve taskList/taskItem structure', () => {
      const originalAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'taskList',
            attrs: { localId: 'list-1' },
            content: [
              {
                type: 'taskItem',
                attrs: { localId: 'item-1', state: 'DONE' },
                content: [{ type: 'text', text: 'Task one' }]
              },
              {
                type: 'taskItem',
                attrs: { localId: 'item-2', state: 'TODO' },
                content: [{ type: 'text', text: 'Task two' }]
              }
            ]
          }
        ]
      };

      const markdown = parser.adfToMarkdown(originalAdf);
      const roundTripAdf = parser.markdownToAdf(markdown);

      // Should preserve taskList/taskItem structure
      expect(roundTripAdf.content).toHaveLength(1);
      const taskList = roundTripAdf.content[0] as TaskListNode;
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(2);

      expect(taskList.content[0].type).toBe('taskItem');
      expect(taskList.content[0].attrs.state).toBe('DONE');
      expect(taskList.content[1].type).toBe('taskItem');
      expect(taskList.content[1].attrs.state).toBe('TODO');

      // Text content should be preserved
      const text1 = taskList.content[0].content?.find(n => n.type === 'text');
      expect(text1?.text).toBe('Task one');
      const text2 = taskList.content[1].content?.find(n => n.type === 'text');
      expect(text2?.text).toBe('Task two');
    });
  });
});
