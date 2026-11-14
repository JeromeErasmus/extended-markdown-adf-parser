/**
 * @file Tests for LinkConverter
 */

import { describe, it, expect, jest } from '@jest/globals';
import { LinkConverter } from '../../../src/parser/adf-to-markdown/marks/LinkConverter';
import type { ConversionContext } from '../../../src/parser/types';
import type { LinkMark } from '../../../src/types';

const mockContext: ConversionContext = {
  convertChildren: jest.fn(),
  depth: 0,
  options: {}
};

describe('LinkConverter', () => {
  const converter = new LinkConverter();

  describe('markType', () => {
    it('should have correct markType', () => {
      expect(converter.markType).toBe('link');
    });
  });

  describe('toMarkdown', () => {
    it('should convert link with href only', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://example.com'
        }
      };
      const text = 'Example Link';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Example Link](https://example.com)');
    });

    it('should convert link with href and title', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://github.com',
          title: 'GitHub Homepage'
        }
      };
      const text = 'GitHub';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[GitHub](https://github.com "GitHub Homepage")');
    });

    it('should handle empty text', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://empty.com'
        }
      };
      const text = '';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[](https://empty.com)');
    });

    it('should handle relative URLs', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: '/docs/getting-started'
        }
      };
      const text = 'Getting Started';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Getting Started](/docs/getting-started)');
    });

    it('should handle mailto links', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'mailto:test@example.com',
          title: 'Send Email'
        }
      };
      const text = 'Contact Us';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Contact Us](mailto:test@example.com "Send Email")');
    });

    it('should return text only for invalid link (missing href)', () => {
      const mark = {
        type: 'link',
        attrs: {}
      } as any;
      const text = 'Invalid Link';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('Invalid Link');
    });

    it('should return text only for link with undefined attrs', () => {
      const mark = {
        type: 'link'
      } as any;
      const text = 'No Attrs Link';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('No Attrs Link');
    });

    it('should preserve link for empty-string href rather than dropping it', () => {
      // AdfValidator accepts href: '' as valid (Jira doesn't enforce URI
      // grammar), so this must round-trip as a link, not silently fall
      // back to plain text.
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: ''
        }
      };
      const text = 'Empty Href Link';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Empty Href Link]()');
    });

    it('should include custom attributes in metadata', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://custom.com',
          title: 'Custom Link',
          target: '_blank',
          rel: 'noopener'
        } as any
      };
      const text = 'Custom Link';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Custom Link](https://custom.com "Custom Link")<!-- adf:link attrs=\'{"target":"_blank","rel":"noopener"}\' -->');
    });

    it('should not include metadata when only href and title are present', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://simple.com',
          title: 'Simple Link'
        }
      };
      const text = 'Simple';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Simple](https://simple.com "Simple Link")');
    });

    it('should handle links with special characters in text', () => {
      const mark: LinkMark = {
        type: 'link',
        attrs: {
          href: 'https://example.com/path?q=test&r=value'
        }
      };
      const text = 'Link with [brackets] and *asterisks*';

      const result = converter.toMarkdown(text, mark, mockContext);
      expect(result).toBe('[Link with [brackets] and *asterisks*](https://example.com/path?q=test&r=value)');
    });
  });
});