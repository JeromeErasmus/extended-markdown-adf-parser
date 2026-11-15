/**
 * @file Tests for CodeBlockConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { CodeBlockConverter } from '../../../src/parser/adf-to-markdown/nodes/CodeBlockConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { CodeBlockNode } from '../../../src/types';

const mockContext: ConversionContext = {
  convertChildren: jest.fn(),
  depth: 0,
  options: {}
};

describe('CodeBlockConverter', () => {
  const converter = new CodeBlockConverter();

  describe('nodeType', () => {
    it('should have correct nodeType', () => {
      expect(converter.nodeType).toBe('codeBlock');
    });
  });

  describe('toMarkdown', () => {
    it('should convert code block with language', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'javascript' },
        content: [
          { type: 'text', text: 'console.log("Hello World");' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```javascript\nconsole.log("Hello World");\n```');
    });

    it('should convert code block without language', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        content: [
          { type: 'text', text: 'plain code' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```\nplain code\n```');
    });

    it('should handle multiple text nodes', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'python' },
        content: [
          { type: 'text', text: 'def hello():\n' },
          { type: 'text', text: '    print("Hello")' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```python\ndef hello():\n    print("Hello")\n```');
    });

    it('should handle empty text nodes', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'bash' },
        content: [
          { type: 'text', text: '' },
          { type: 'text', text: 'echo "test"' },
          { type: 'text' } as any
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```bash\necho "test"\n```');
    });

    it('should return empty code block for no content', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'java' },
        content: []
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```\n\n```');
    });

    it('should return empty code block for undefined content', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'java' }
      } as CodeBlockNode;

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```\n\n```');
    });

    it('should include custom attributes in metadata', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: {
          language: 'typescript',
          highlight: true,
          lineNumbers: false
        } as any,
        content: [
          { type: 'text', text: 'const x: number = 42;' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```typescript\nconst x: number = 42;\n```<!-- adf:codeblock attrs=\'{"highlight":true,"lineNumbers":false}\' -->');
    });

    it('should not include metadata when only language is present', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'sql' },
        content: [
          { type: 'text', text: 'SELECT * FROM users;' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      expect(result).toBe('```sql\nSELECT * FROM users;\n```');
    });

    it('should handle code with backticks', () => {
      const node: CodeBlockNode = {
        type: 'codeBlock',
        attrs: { language: 'markdown' },
        content: [
          { type: 'text', text: '```javascript\nconsole.log("nested");\n```' }
        ]
      };

      const result = converter.toMarkdown(node, mockContext);
      // Fence must be longer than the content's longest backtick run (3) so it
      // doesn't close early on the nested ``` (issue #20)
      expect(result).toBe('````markdown\n```javascript\nconsole.log("nested");\n```\n````');
    });
  });
});