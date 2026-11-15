/**
 * @file Tests for BulletListConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { BulletListConverter } from '../../../src/parser/adf-to-markdown/nodes/BulletListConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { BulletListNode } from '../../../src/types';

describe('BulletListConverter', () => {
  const converter = new BulletListConverter();

  const mockListItemConverter = {
    nodeType: 'listItem',
    toMarkdown: jest.fn().mockImplementation((node: any) => `- ${node.content?.[0]?.content?.[0]?.text || 'item'}`)
  };

  const mockContext: ConversionContext = {
    convertChildren: jest.fn(),
    depth: 0,
    options: {
      registry: {
        getNodeConverter: jest.fn().mockReturnValue(mockListItemConverter)
      } as any
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nodeType', () => {
    it('should have correct nodeType', () => {
      expect(converter.nodeType).toBe('bulletList');
    });
  });

  describe('toMarkdown', () => {
    it('should convert single item bullet list', () => {
      const node: BulletListNode = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'First item' }]
              }
            ]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- First item');
      expect(mockListItemConverter.toMarkdown).toHaveBeenCalled();
    });

    it('should convert multi-item bullet list', () => {
      mockListItemConverter.toMarkdown
        .mockReturnValueOnce('- First item')
        .mockReturnValueOnce('- Second item')
        .mockReturnValueOnce('- Third item');

      const node: BulletListNode = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'First item' }]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Second item' }]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Third item' }]
              }
            ]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- First item\n- Second item\n- Third item');
      expect(mockListItemConverter.toMarkdown).toHaveBeenCalledTimes(3);
    });

    it('should handle empty bullet list', () => {
      const node: BulletListNode = {
        type: 'bulletList',
        content: []
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should handle bullet list with undefined content', () => {
      const node: BulletListNode = {
        type: 'bulletList'
      } as BulletListNode;

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should filter out empty list items', () => {
      mockListItemConverter.toMarkdown
        .mockReturnValueOnce('- First item')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('- Third item');

      const node: BulletListNode = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'First item' }]
              }
            ]
          },
          {
            type: 'listItem',
            content: []
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Third item' }]
              }
            ]
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('- First item\n- Third item');
    });

    it('should handle missing listItem converter', () => {
      const contextWithoutConverter: ConversionContext = {
        ...mockContext,
        options: {
          registry: {
            getNodeConverter: jest.fn().mockReturnValue(null)
          } as any
        }
      };

      const node: BulletListNode = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'First item' }]
              }
            ]
          }
        ]
      };

      const result = converter.toMarkdown(node, contextWithoutConverter);
      expect(result).toBe('');
    });

    it('should pass correct context to list items', () => {
      const node: BulletListNode = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Test item' }]
              }
            ]
          }
        ]
      };

      converter.toMarkdown(node, mockContext);

      expect(mockListItemConverter.toMarkdown).toHaveBeenCalledWith(
        node.content![0],
        {
          ...mockContext,
          depth: mockContext.depth + 1,
          parent: node,
          marker: '- '
        }
      );
    });
  });
});