/**
 * @file Integration tests using real ADF fixtures
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../src/index.js';
import { normalizeMarkdownForComparison } from '../../src/utils/test-utils.js';
import type { ADFDocument } from '../../src/index.js';

describe('ADF Fixtures Integration Tests', () => {
  const parser = new Parser();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const fixturesDir = join(__dirname, '..', 'fixtures');

  const loadFixture = (name: string): { adf: ADFDocument; expected: string } => {
    const adfPath = join(fixturesDir, 'adf', `${name}.adf`);
    const expectedPath = join(fixturesDir, 'markdown', `${name}.md`);
    
    const adf = JSON.parse(readFileSync(adfPath, 'utf8')) as ADFDocument;
    const expected = readFileSync(expectedPath, 'utf8');
    
    return { adf, expected };
  };

  describe('Simple Document', () => {
    it('should convert basic ADF with headings, paragraphs, and lists', () => {
      const { adf, expected } = loadFixture('simple-document');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(normalizeMarkdownForComparison(result)).toBe(normalizeMarkdownForComparison(expected));
    });

    it('should validate ADF structure', () => {
      const { adf } = loadFixture('simple-document');
      
      const validation = parser.validateAdf(adf);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Rich Content', () => {
    it('should convert panels, code blocks, and blockquotes', () => {
      const { adf, expected } = loadFixture('rich-content');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(normalizeMarkdownForComparison(result)).toBe(normalizeMarkdownForComparison(expected));
    });

    it('should handle complex mark combinations', () => {
      const { adf } = loadFixture('rich-content');
      
      const result = parser.adfToMarkdown(adf);
      
      // Should contain all mark types
      expect(result).toContain('**information panel**'); // strong
      expect(result).toContain('[links](https://developer.atlassian.com "Atlassian Developer")'); // link
      expect(result).toContain('`inline code`'); // code
      expect(result).toContain('*emphasized text*'); // em
      expect(result).toContain('~~strikethrough~~'); // strike
    });

    it('should preserve code block language', () => {
      const { adf } = loadFixture('rich-content');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('```javascript\n');
      expect(result).toContain('import { Parser }');
    });
  });

  describe('Table Document', () => {
    it('should convert tables with headers and styled content', () => {
      const { adf, expected } = loadFixture('table-document');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(normalizeMarkdownForComparison(result)).toBe(normalizeMarkdownForComparison(expected));
    });

    it('should handle table structure correctly', () => {
      const { adf } = loadFixture('table-document');
      
      const result = parser.adfToMarkdown(adf);
      
      // Should have proper table structure
      expect(result).toMatch(/\|.*\|.*\|.*\|/); // Table rows
      expect(result).toMatch(/\| -------- \| -------- \| -------- \|/); // Separator
      expect(result).toContain('**Feature**'); // Header formatting
    });

    it('should preserve text color in cells', () => {
      const { adf } = loadFixture('table-document');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('<span style="color: #36B37E">Complete</span>');
      expect(result).toContain('<span style="color: #36B37E">Done</span>');
    });

    it('should handle underline marks', () => {
      const { adf } = loadFixture('table-document');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('<u>npm publish</u>');
    });
  });

  describe('Media and Expand Content', () => {
    it('should convert media and expandable sections', () => {
      const { adf, expected } = loadFixture('media-expand');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(normalizeMarkdownForComparison(result)).toBe(normalizeMarkdownForComparison(expected));
    });

    it('should handle media with attributes', () => {
      const { adf } = loadFixture('media-expand');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('![Media](adf:media:architecture-diagram-2024)');
      expect(result).toContain('<!-- adf:media id="architecture-diagram-2024" type="file"');
      expect(result).toContain('collection="project-assets" width="800" height="600"');
    });

    it('should handle mediaSingle layout and width', () => {
      const { adf } = loadFixture('media-expand');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('<!-- adf:mediaSingle layout="center" width="80" -->');
    });

    it('should convert expand sections', () => {
      const { adf } = loadFixture('media-expand');
      
      const result = parser.adfToMarkdown(adf);
      
      expect(result).toContain('~~~expand title="Technical Implementation Details"');
      expect(result).toContain('~~~expand title="Performance Metrics" attrs=\'{"nested":true}\'');
    });

    it('should handle nested ordered and bullet lists', () => {
      const { adf } = loadFixture('media-expand');
      
      const result = parser.adfToMarkdown(adf);
      
      // Ordered list
      expect(result).toContain('1. Parser architecture uses');
      expect(result).toContain('2. ESM-only for modern');
      expect(result).toContain('3. Converter registry system');
      
      // Bullet list inside nested expand
      expect(result).toContain('- Build time: **44ms**');
      expect(result).toContain('- Test suite: **2.8s**');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ADF gracefully', () => {
      const invalidAdf = { type: 'invalid', content: [] };
      
      expect(() => {
        parser.adfToMarkdown(invalidAdf as ADFDocument);
      }).not.toThrow();
    });

    it('should validate invalid ADF structure', () => {
      const invalidAdf = { type: 'invalid', content: 'not-an-array' };
      
      const validation = parser.validateAdf(invalidAdf);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing content gracefully', () => {
      const adfWithMissingContent: ADFDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph'
            // Missing content property
          } as any
        ]
      };
      
      const result = parser.adfToMarkdown(adfWithMissingContent);
      
      expect(result).toBe('');
    });
  });

  describe('Parser Configuration', () => {
    it('should work with strict validation enabled', () => {
      const { adf } = loadFixture('simple-document');
      
      const result = parser.adfToMarkdown(adf, { strict: true });
      
      expect(result).toBeTruthy();
    });

    it('should throw on invalid ADF with strict mode', () => {
      const invalidAdf = { type: 'invalid', content: [] };
      
      expect(() => {
        parser.adfToMarkdown(invalidAdf as ADFDocument, { strict: true });
      }).toThrow();
    });
  });

  describe('All Fixtures Validation', () => {
    const fixtures = [
      'simple-document',
      'rich-content',
      'table-document',
      'media-expand',
      'edge-cases',
      'schema-mark-regressions',
      'table-cell-whitespace',
      'modern-elements'
    ];

    fixtures.forEach(fixtureName => {
      it(`should successfully convert ${fixtureName}`, () => {
        const { adf, expected } = loadFixture(fixtureName);
        
        const result = parser.adfToMarkdown(adf);
        
        expect(normalizeMarkdownForComparison(result)).toBe(normalizeMarkdownForComparison(expected));
        expect(result.length).toBeGreaterThan(0);
      });

      it(`should validate ${fixtureName} ADF structure`, () => {
        const { adf } = loadFixture(fixtureName);
        
        const validation = parser.validateAdf(adf);
        
        
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });
  });
});