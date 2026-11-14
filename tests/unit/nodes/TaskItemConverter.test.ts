/**
 * @file Tests for TaskItemConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { TaskItemConverter } from '../../../src/parser/adf-to-markdown/nodes/TaskItemConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { TaskItemNode } from '../../../src/types';

describe('TaskItemConverter', () => {
  const converter = new TaskItemConverter();

  const mockTextConverter = {
    nodeType: 'text',
    toMarkdown: jest.fn()
  };

  const mockContext: ConversionContext = {
    convertChildren: jest.fn(),
    depth: 0,
    options: {
      registry: {
        getNodeConverter: jest.fn().mockReturnValue(mockTextConverter)
      } as any
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nodeType', () => {
    it('should have correct nodeType', () => {
      expect(converter.nodeType).toBe('taskItem');
    });
  });

  describe('toMarkdown', () => {
    it('should convert DONE state with correct prefix', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'DONE' },
        content: [{ type: 'text', text: 'Completed task' }]
      };

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('Completed task');

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] Completed task');
    });

    it('should convert TODO state with correct prefix', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'TODO' },
        content: [{ type: 'text', text: 'Pending task' }]
      };

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('Pending task');

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [ ] Pending task');
    });

    it('should handle inline content directly (not paragraph-wrapped)', () => {
      // taskItem content is inline nodes (text, emoji, mention, etc.), not paragraphs
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'DONE' },
        content: [
          { type: 'text', text: 'Direct inline text' }
        ]
      };

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('Direct inline text');

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] Direct inline text');
      // Verify it looked up a converter for the text node, not a paragraph converter
      expect(mockContext.options.registry?.getNodeConverter).toHaveBeenCalledWith('text');
    });

    it('should handle multiple inline nodes', () => {
      const mockStrongConverter = {
        nodeType: 'text',
        toMarkdown: jest.fn()
      };

      const contextWithMultipleConverters: ConversionContext = {
        ...mockContext,
        options: {
          registry: {
            getNodeConverter: jest.fn().mockImplementation((type: string) => {
              return mockStrongConverter;
            })
          } as any
        }
      };

      mockStrongConverter.toMarkdown
        .mockReturnValueOnce('Bold text')
        .mockReturnValueOnce(' and ')
        .mockReturnValueOnce('more text');

      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'TODO' },
        content: [
          { type: 'text', text: 'Bold text', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'more text' }
        ]
      };

      const result = converter.toMarkdown(node, contextWithMultipleConverters);
      expect(result).toBe('- [ ] Bold text and more text');
    });

    it('should handle empty content', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'TODO' },
        content: []
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [ ] ');
    });

    it('should handle undefined content', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'DONE' }
      } as TaskItemNode;

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] ');
    });

    it('should handle multi-line content with proper indentation', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'DONE' },
        content: [{ type: 'text', text: 'First line\nSecond line\nThird line' }]
      };

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('First line\nSecond line\nThird line');

      const result = converter.toMarkdown(node, mockContext);
      // 6-space indent for continuation lines to align with content after '- [x] '
      expect(result).toBe('- [x] First line\n      Second line\n      Third line');
    });

    it('should preserve empty lines in multi-line content', () => {
      const node: TaskItemNode = {
        type: 'taskItem',
        attrs: { localId: 'test-1', state: 'TODO' },
        content: [{ type: 'text', text: 'Line 1\n\nLine 3' }]
      };

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('Line 1\n\nLine 3');

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [ ] Line 1\n\n      Line 3');
    });

    it('should default to TODO when state is not DONE', () => {
      // Edge case: attrs missing state entirely
      const node = {
        type: 'taskItem',
        attrs: { localId: 'test-1' },
        content: [{ type: 'text', text: 'Task' }]
      } as any;

      (mockTextConverter.toMarkdown as jest.Mock).mockReturnValue('Task');

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [ ] Task');
    });
  });
});
