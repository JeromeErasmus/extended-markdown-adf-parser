/**
 * @file Tests for OrderedListConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { OrderedListConverter } from '../../../src/parser/adf-to-markdown/nodes/OrderedListConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { OrderedListNode } from '../../../src/types';

describe('OrderedListConverter', () => {
  const converter = new OrderedListConverter();

  const mockListItemConverter = {
    nodeType: 'listItem',
    toMarkdown: jest.fn().mockImplementation(
      (node: any, ctx: any) => `${ctx?.marker ?? '- '}${node.content?.[0]?.content?.[0]?.text || 'item'}`
    )
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
      expect(converter.nodeType).toBe('orderedList');
    });
  });

  describe('toMarkdown', () => {
    it('should convert single item ordered list', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
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
      expect(result).toBe('1. First item');
      expect(mockListItemConverter.toMarkdown).toHaveBeenCalled();
    });

    it('should convert multi-item ordered list with correct numbering', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
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
      expect(result).toBe('1. First item\n2. Second item\n3. Third item');
      expect(mockListItemConverter.toMarkdown).toHaveBeenCalledTimes(3);
    });

    it('should respect custom start order', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
        attrs: {
          order: 5
        },
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
          }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('5. First item\n6. Second item');
    });

    it('should handle empty ordered list', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
        content: []
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should handle ordered list with undefined content', () => {
      const node: OrderedListNode = {
        type: 'orderedList'
      } as OrderedListNode;

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('');
    });

    it('should filter out empty list items', () => {
      mockListItemConverter.toMarkdown
        .mockImplementationOnce((_node: any, ctx: any) => `${ctx.marker}First item`)
        .mockReturnValueOnce('')
        .mockImplementationOnce((_node: any, ctx: any) => `${ctx.marker}Third item`);

      const node: OrderedListNode = {
        type: 'orderedList',
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
      expect(result).toBe('1. First item\n3. Third item');
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

      const node: OrderedListNode = {
        type: 'orderedList',
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

    it('should include custom attributes in metadata', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
        attrs: {
          order: 1,
          customAttr: 'value',
          listStyle: 'roman'
        } as any,
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Item with metadata' }]
              }
            ]
          }
        ]
      };

      mockListItemConverter.toMarkdown.mockImplementation((_node: any, ctx: any) => `${ctx.marker}Item with metadata`);

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('1. Item with metadata<!-- adf:orderedList attrs=\'{"customAttr":"value","listStyle":"roman"}\' -->');
    });

    it('should not include metadata when only order attribute present', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
        attrs: {
          order: 3
        },
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Simple item' }]
              }
            ]
          }
        ]
      };

      mockListItemConverter.toMarkdown.mockImplementation((_node: any, ctx: any) => `${ctx.marker}Simple item`);

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('3. Simple item');
    });

    it('should pass correct context to list items', () => {
      const node: OrderedListNode = {
        type: 'orderedList',
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
          marker: '1. '
        }
      );
    });
  });
});