/**
 * @file Tests for TaskListConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { TaskListConverter } from '../../../src/parser/adf-to-markdown/nodes/TaskListConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { TaskListNode } from '../../../src/types';

describe('TaskListConverter', () => {
  const converter = new TaskListConverter();

  const mockTaskItemConverter = {
    nodeType: 'taskItem',
    toMarkdown: jest.fn().mockImplementation((node: any) => {
      const prefix = node.attrs?.state === 'DONE' ? '- [x] ' : '- [ ] ';
      const text = node.content?.[0]?.text || 'item';
      return `${prefix}${text}`;
    })
  };

  const mockContext: ConversionContext = {
    convertChildren: jest.fn(),
    depth: 0,
    options: {
      registry: {
        getNodeConverter: jest.fn().mockReturnValue(mockTaskItemConverter)
      } as any
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nodeType', () => {
    it('should have correct nodeType', () => {
      expect(converter.nodeType).toBe('taskList');
    });
  });

  describe('toMarkdown', () => {
    it('should convert single DONE taskItem', () => {
      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'test-item-1', state: 'DONE' },
            content: [{ type: 'text', text: 'Completed task' }]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] Completed task');
      expect(mockTaskItemConverter.toMarkdown).toHaveBeenCalledTimes(1);
    });

    it('should convert single TODO taskItem', () => {
      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'test-item-1', state: 'TODO' },
            content: [{ type: 'text', text: 'Pending task' }]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [ ] Pending task');
      expect(mockTaskItemConverter.toMarkdown).toHaveBeenCalledTimes(1);
    });

    it('should convert mixed state taskList', () => {
      mockTaskItemConverter.toMarkdown
        .mockReturnValueOnce('- [x] Done task')
        .mockReturnValueOnce('- [ ] Todo task')
        .mockReturnValueOnce('- [x] Another done');

      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'item-1', state: 'DONE' },
            content: [{ type: 'text', text: 'Done task' }]
          },
          {
            type: 'taskItem',
            attrs: { localId: 'item-2', state: 'TODO' },
            content: [{ type: 'text', text: 'Todo task' }]
          },
          {
            type: 'taskItem',
            attrs: { localId: 'item-3', state: 'DONE' },
            content: [{ type: 'text', text: 'Another done' }]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] Done task\n- [ ] Todo task\n- [x] Another done');
      expect(mockTaskItemConverter.toMarkdown).toHaveBeenCalledTimes(3);
    });

    it('should handle empty taskList', () => {
      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: []
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should handle taskList with undefined content', () => {
      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' }
      } as TaskListNode;

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should filter out empty items', () => {
      mockTaskItemConverter.toMarkdown
        .mockReturnValueOnce('- [x] First task')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('- [ ] Third task');

      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'item-1', state: 'DONE' },
            content: [{ type: 'text', text: 'First task' }]
          },
          {
            type: 'taskItem',
            attrs: { localId: 'item-2', state: 'TODO' },
            content: []
          },
          {
            type: 'taskItem',
            attrs: { localId: 'item-3', state: 'TODO' },
            content: [{ type: 'text', text: 'Third task' }]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- [x] First task\n- [ ] Third task');
    });

    it('should handle missing taskItem converter (fallback)', () => {
      const contextWithoutConverter: ConversionContext = {
        ...mockContext,
        options: {
          registry: {
            getNodeConverter: jest.fn().mockReturnValue(null)
          } as any
        }
      };

      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'item-1', state: 'DONE' },
            content: [{ type: 'text', text: 'Task' }]
          }
        ]
      };

      const result = converter.toMarkdown(node, contextWithoutConverter);
      expect(result).toBe('');
    });

    it('should pass correct context to taskItem converter', () => {
      const node: TaskListNode = {
        type: 'taskList',
        attrs: { localId: 'test-list-1' },
        content: [
          {
            type: 'taskItem',
            attrs: { localId: 'item-1', state: 'DONE' },
            content: [{ type: 'text', text: 'Test task' }]
          }
        ]
      };

      converter.toMarkdown(node, mockContext);

      expect(mockTaskItemConverter.toMarkdown).toHaveBeenCalledWith(
        node.content![0],
        {
          ...mockContext,
          depth: mockContext.depth + 1,
          parent: node
        }
      );
    });
  });
});
