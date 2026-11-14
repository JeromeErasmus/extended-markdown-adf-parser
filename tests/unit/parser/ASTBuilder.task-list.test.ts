/**
 * @file ASTBuilder.task-list.test.ts
 * @description Tests for ASTBuilder task-list conversion in both mdast and token paths
 *
 * The ASTBuilder has two conversion paths:
 *   1. mdast path: buildADFFromMdast -> convertMdastList / convertMdastTaskItem
 *   2. token path: buildADF -> convertList / convertTaskItem
 */

import { ASTBuilder } from '../../../src/parser/markdown-to-adf/ASTBuilder.js';
import type { ListItemToken, Token } from '../../../src/parser/markdown-to-adf/types.js';

describe('ASTBuilder - Task List Conversion', () => {
  let builder: ASTBuilder;

  beforeEach(() => {
    builder = new ASTBuilder();
  });

  // ---------------------------------------------------------------
  // Section 1: mdast path tests (buildADFFromMdast / convertMdastList)
  // ---------------------------------------------------------------
  describe('mdast path: convertMdastList / convertMdastTaskItem', () => {
    /**
     * Helper to build a minimal mdast tree with a list node.
     * remark-gfm represents checkbox items as listItem nodes with
     * `checked: true|false` and paragraph children whose text does
     * NOT include the `[x]` prefix.
     */
    function mdastList(items: Array<{ checked?: boolean | null; text: string; children?: any[] }>, ordered = false): any {
      return {
        type: 'root',
        children: [{
          type: 'list',
          ordered,
          start: ordered ? 1 : null,
          spread: false,
          children: items.map(item => ({
            type: 'listItem',
            checked: item.checked ?? null,
            spread: false,
            children: item.children ?? [{
              type: 'paragraph',
              children: [{ type: 'text', value: item.text }]
            }]
          }))
        }]
      };
    }

    it('should convert "- [x] Done" to taskList with taskItem state=DONE', () => {
      const tree = mdastList([{ checked: true, text: 'Done' }]);
      const adf = builder.buildADFFromMdast(tree);

      expect(adf.content).toHaveLength(1);
      const taskList = adf.content[0];
      expect(taskList.type).toBe('taskList');
      expect(taskList.attrs).toBeDefined();
      expect(taskList.attrs!.localId).toBeDefined();
      expect(taskList.content).toHaveLength(1);

      const taskItem = taskList.content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs!.state).toBe('DONE');
    });

    it('should convert "- [ ] Todo" to taskItem with state=TODO', () => {
      const tree = mdastList([{ checked: false, text: 'Todo' }]);
      const adf = builder.buildADFFromMdast(tree);

      const taskList = adf.content[0];
      expect(taskList.type).toBe('taskList');
      const taskItem = taskList.content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs!.state).toBe('TODO');
    });

    it('should convert mixed checkbox list to single taskList with correct states', () => {
      const tree = mdastList([
        { checked: true, text: 'A' },
        { checked: false, text: 'B' }
      ]);
      const adf = builder.buildADFFromMdast(tree);

      expect(adf.content).toHaveLength(1);
      const taskList = adf.content[0];
      expect(taskList.type).toBe('taskList');
      expect(taskList.content).toHaveLength(2);

      expect(taskList.content![0].attrs!.state).toBe('DONE');
      expect(taskList.content![1].attrs!.state).toBe('TODO');
    });

    it('should keep regular bullet list (no checkboxes) as bulletList', () => {
      const tree = mdastList([
        { text: 'item one' },
        { text: 'item two' }
      ]);
      const adf = builder.buildADFFromMdast(tree);

      expect(adf.content).toHaveLength(1);
      expect(adf.content[0].type).toBe('bulletList');
    });

    it('taskItem content should be inline nodes (no paragraph wrapper)', () => {
      const tree = mdastList([{ checked: true, text: 'Simple text' }]);
      const adf = builder.buildADFFromMdast(tree);

      const taskItem = adf.content[0].content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.content).toBeDefined();

      // Should NOT have paragraph wrapper
      const hasParagraph = taskItem.content!.some(n => n.type === 'paragraph');
      expect(hasParagraph).toBe(false);

      // Should have inline text node
      const textNode = taskItem.content!.find(n => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode!.text).toBe('Simple text');
    });

    it('should generate non-empty, unique localId attributes', () => {
      const tree = mdastList([
        { checked: true, text: 'Task 1' },
        { checked: false, text: 'Task 2' }
      ]);
      const adf = builder.buildADFFromMdast(tree);

      const taskList = adf.content[0];
      expect(typeof taskList.attrs!.localId).toBe('string');
      expect((taskList.attrs!.localId as string).length).toBeGreaterThan(0);

      const ids: string[] = [taskList.attrs!.localId as string];
      for (const item of taskList.content!) {
        expect(typeof item.attrs!.localId).toBe('string');
        expect((item.attrs!.localId as string).length).toBeGreaterThan(0);
        ids.push(item.attrs!.localId as string);
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should preserve inline formatting (bold text with strong mark)', () => {
      const tree: any = {
        type: 'root',
        children: [{
          type: 'list',
          ordered: false,
          children: [{
            type: 'listItem',
            checked: true,
            children: [{
              type: 'paragraph',
              children: [
                {
                  type: 'strong',
                  children: [{ type: 'text', value: 'bold' }]
                },
                { type: 'text', value: ' text' }
              ]
            }]
          }]
        }]
      };

      const adf = builder.buildADFFromMdast(tree);
      const taskItem = adf.content[0].content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs!.state).toBe('DONE');
      expect(taskItem.content).toBeDefined();

      // Find bold node (text with strong mark)
      const boldNode = taskItem.content!.find(
        n => n.type === 'text' && n.marks?.some(m => m.type === 'strong')
      );
      expect(boldNode).toBeDefined();
      expect(boldNode!.text).toBe('bold');
    });

    it('should handle uppercase X as checked (via mdast checked property)', () => {
      // In mdast, remark-gfm normalizes [X] and [x] to checked: true
      const tree = mdastList([{ checked: true, text: 'Done' }]);
      const adf = builder.buildADFFromMdast(tree);

      const taskItem = adf.content[0].content![0];
      expect(taskItem.attrs!.state).toBe('DONE');
    });

    it('should fall back to bulletList when checkbox item has nested sub-list', () => {
      const tree: any = {
        type: 'root',
        children: [{
          type: 'list',
          ordered: false,
          children: [{
            type: 'listItem',
            checked: true,
            children: [
              { type: 'paragraph', children: [{ type: 'text', value: 'Task with sub-list' }] },
              {
                type: 'list',
                ordered: false,
                children: [{
                  type: 'listItem',
                  checked: null,
                  children: [{ type: 'paragraph', children: [{ type: 'text', value: 'nested item' }] }]
                }]
              }
            ]
          }]
        }]
      };

      const adf = builder.buildADFFromMdast(tree);
      expect(adf.content).toHaveLength(1);
      // Should fall back to bulletList since item has complex content (nested list)
      expect(adf.content[0].type).toBe('bulletList');
    });

    it('should fall back to bulletList when checkbox item has multiple paragraphs', () => {
      const tree: any = {
        type: 'root',
        children: [{
          type: 'list',
          ordered: false,
          children: [{
            type: 'listItem',
            checked: true,
            children: [
              { type: 'paragraph', children: [{ type: 'text', value: 'First para' }] },
              { type: 'paragraph', children: [{ type: 'text', value: 'Second para' }] }
            ]
          }]
        }]
      };

      const adf = builder.buildADFFromMdast(tree);
      expect(adf.content[0].type).toBe('bulletList');
    });
  });

  // ---------------------------------------------------------------
  // Section 2: token path tests (buildADF -> convertList / convertTaskItem)
  // ---------------------------------------------------------------
  describe('token path: convertList / convertTaskItem', () => {
    /**
     * Helper to build token structures that mimic what MarkdownTokenizer produces.
     * The tokenizer produces a `list` token with `listItem` children.
     * Checkbox items have a `checked` property on the listItem token.
     * Each listItem has a `paragraph` child token with the item text.
     */
    function listToken(items: Array<{ checked?: boolean; text: string }>, ordered = false): Token[] {
      const pos = { line: 1, column: 1, offset: 0 };
      return [{
        type: 'list' as const,
        ordered,
        start: ordered ? 1 : undefined,
        tight: true,
        content: '',
        position: pos,
        raw: '',
        children: items.map(item => {
          const token: any = {
            type: 'listItem' as const,
            content: item.text,
            position: pos,
            raw: '',
            children: [{
              type: 'paragraph' as const,
              content: item.text,
              position: pos,
              raw: '',
            }]
          };
          if (item.checked !== undefined) {
            token.checked = item.checked;
          }
          return token;
        })
      } as any];
    }

    it('should convert token with checked: true to taskItem state=DONE', () => {
      const tokens = listToken([{ checked: true, text: 'Done' }]);
      const adf = builder.buildADF(tokens);

      expect(adf.content).toHaveLength(1);
      const taskList = adf.content[0];
      expect(taskList.type).toBe('taskList');

      const taskItem = taskList.content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs!.state).toBe('DONE');
    });

    it('should convert token with checked: false to taskItem state=TODO', () => {
      const tokens = listToken([{ checked: false, text: 'Todo' }]);
      const adf = builder.buildADF(tokens);

      const taskItem = adf.content[0].content![0];
      expect(taskItem.type).toBe('taskItem');
      expect(taskItem.attrs!.state).toBe('TODO');
    });

    it('should produce taskList when list tokens have checked property', () => {
      const tokens = listToken([
        { checked: true, text: 'A' },
        { checked: false, text: 'B' }
      ]);
      const adf = builder.buildADF(tokens);

      expect(adf.content).toHaveLength(1);
      expect(adf.content[0].type).toBe('taskList');
      expect(adf.content[0].content).toHaveLength(2);
    });

    it('should produce bulletList when tokens have no checked property', () => {
      const tokens = listToken([
        { text: 'Regular 1' },
        { text: 'Regular 2' }
      ]);
      const adf = builder.buildADF(tokens);

      expect(adf.content).toHaveLength(1);
      expect(adf.content[0].type).toBe('bulletList');
    });

    it('should generate unique localIds on taskList and taskItems', () => {
      const tokens = listToken([
        { checked: true, text: 'X' },
        { checked: false, text: 'Y' }
      ]);
      const adf = builder.buildADF(tokens);

      const taskList = adf.content[0];
      const ids = [taskList.attrs!.localId as string];
      for (const item of taskList.content!) {
        ids.push(item.attrs!.localId as string);
      }

      // All non-empty and unique
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should fall back to bulletList when items are complex (nested children)', () => {
      const pos = { line: 1, column: 1, offset: 0 };
      // Complex item: has a nested list child (not just a single paragraph)
      const tokens: Token[] = [{
        type: 'list' as const,
        ordered: false,
        tight: true,
        content: '',
        position: pos,
        raw: '',
        children: [{
          type: 'listItem' as const,
          content: 'Task text',
          checked: true,
          position: pos,
          raw: '',
          children: [
            { type: 'paragraph' as const, content: 'Task text', position: pos, raw: '' },
            { type: 'list' as const, content: '', position: pos, raw: '', children: [] }
          ]
        } as any]
      } as any];

      const adf = builder.buildADF(tokens);
      // Should fall back to bulletList since item has complex content
      expect(adf.content[0].type).toBe('bulletList');
      const listItem = adf.content[0].content![0];
      expect(listItem.type).toBe('listItem');
    });

    it('should preserve checkbox text via content fallback when item has no children', () => {
      const pos = { line: 1, column: 1, offset: 0 };
      // Item with checked but no simple paragraph child - uses content string fallback
      // This tests the re-prepend logic: when falling back, [x] is added to content
      const tokens: Token[] = [{
        type: 'list' as const,
        ordered: false,
        tight: true,
        content: '',
        position: pos,
        raw: '',
        children: [
          {
            type: 'listItem' as const,
            content: 'Checked task',
            checked: true,
            position: pos,
            raw: '',
            // Two children makes it "complex" (not simple), triggering fallback
            children: [
              { type: 'paragraph' as const, content: 'First para', position: pos, raw: '' },
              { type: 'paragraph' as const, content: 'Second para', position: pos, raw: '' }
            ]
          } as any
        ]
      } as any];

      const adf = builder.buildADF(tokens);
      expect(adf.content[0].type).toBe('bulletList');

      // The checkbox state must be visible in the rendered ADF output -
      // not just mutated on an internal token field that's never read.
      const listItem = adf.content[0].content[0];
      const firstParagraphText = listItem.content[0].content[0];
      expect(firstParagraphText.text).toBe('[x] First para');
    });
  });
});
