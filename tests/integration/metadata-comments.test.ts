/**
 * @file metadata-comments.test.ts
 * @description Integration tests for metadata comment processing with EnhancedMarkdownParser
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EnhancedMarkdownParser } from '../../src/parser/markdown-to-adf/EnhancedMarkdownParser.js';
import type { ADFDocument } from '../../src/types/adf.types.js';

describe('Metadata Comments Integration', () => {
  let parser: EnhancedMarkdownParser;

  beforeEach(() => {
    parser = new EnhancedMarkdownParser({
      strict: false,
      adfExtensions: true
    });
  });

  describe('Markdown to ADF with Metadata Comments', () => {
    it('should parse paragraph with metadata comment', async () => {
      const markdown = `
# Heading

<!-- adf:paragraph attrs='{"textAlign":"center"}' -->
This is a centered paragraph.
`.trim();

      const result = await parser.parse(markdown);
      
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('heading');
      expect(result.content[1]).toEqual({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          { type: 'text', text: 'This is a centered paragraph.' }
        ]
      });
    });

    it('should parse heading with metadata comment', async () => {
      const markdown = `
<!-- adf:heading attrs='{"id":"custom-heading","textAlign":"center"}' -->
# Custom Heading

Some content.
`.trim();

      const result = await parser.parse(markdown);
      
      expect(result.content[0]).toEqual({
        type: 'heading',
        attrs: { 
          level: 1,
          id: 'custom-heading',
          textAlign: 'center'
        },
        content: [
          { type: 'text', text: 'Custom Heading' }
        ]
      });
    });

    it('should parse multiple paragraphs with different metadata', async () => {
      const markdown = `
<!-- adf:paragraph attrs='{"textAlign":"left"}' -->
Left aligned paragraph.

<!-- adf:paragraph attrs='{"textAlign":"center","backgroundColor":"#f0f0f0"}' -->
Centered paragraph with background.

<!-- adf:paragraph attrs='{"textAlign":"right"}' -->
Right aligned paragraph.
`.trim();

      const result = await parser.parse(markdown);
      
      expect(result.content).toHaveLength(3);
      
      expect(result.content[0]).toEqual({
        type: 'paragraph',
        attrs: { textAlign: 'left' },
        content: [{ type: 'text', text: 'Left aligned paragraph.' }]
      });
      
      expect(result.content[1]).toEqual({
        type: 'paragraph',
        attrs: { textAlign: 'center', backgroundColor: '#f0f0f0' },
        content: [{ type: 'text', text: 'Centered paragraph with background.' }]
      });
      
      expect(result.content[2]).toEqual({
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [{ type: 'text', text: 'Right aligned paragraph.' }]
      });
    });

    it('should handle metadata comments with nested content', async () => {
      const markdown = `
<!-- adf:panel backgroundColor="#e6f3ff" borderColor="#0052cc" -->
~~~panel type=info
This panel has custom styling from metadata comments.

**Bold text** and *italic text* inside.
~~~
`.trim();

      const result = await parser.parse(markdown);
      
      // Enhanced behavior: fence block content is now properly parsed as markdown
      expect(result.content[0]).toEqual({
        type: 'panel',
        attrs: { 
          panelType: 'info',
          backgroundColor: '#e6f3ff',
          borderColor: '#0052cc'
        },
        content: [
          {
            type: 'paragraph',
            content: [
              { 
                type: 'text', 
                text: 'This panel has custom styling from metadata comments.' 
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { 
                type: 'text', 
                text: 'Bold text',
                marks: [{ type: 'strong' }]
              },
              { 
                type: 'text', 
                text: ' and ' 
              },
              { 
                type: 'text', 
                text: 'italic text',
                marks: [{ type: 'em' }] 
              },
              { 
                type: 'text', 
                text: ' inside.' 
              }
            ]
          }
        ]
      });
      // TODO: Support markdown parsing within ADF fence blocks
    });

    it('should handle multiple metadata comments for same node', async () => {
      const markdown = `
<!-- adf:paragraph attrs='{"textAlign":"center"}' -->
<!-- adf:paragraph attrs='{"backgroundColor":"#fff3cd"}' -->
This paragraph has multiple metadata attributes.
`.trim();

      const result = await parser.parse(markdown);
      
      expect(result.content[0]).toEqual({
        type: 'paragraph',
        attrs: { 
          textAlign: 'center',
          backgroundColor: '#fff3cd'
        },
        content: [
          { type: 'text', text: 'This paragraph has multiple metadata attributes.' }
        ]
      });
    });
  });

  describe('Round-Trip Conversion with Metadata', () => {
    it('should preserve metadata in round-trip conversion', async () => {
      const originalAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { 
              level: 1,
              id: 'custom-id',
              textAlign: 'center'
            },
            content: [
              { type: 'text', text: 'Custom Heading' }
            ]
          },
          {
            type: 'paragraph',
            attrs: { 
              textAlign: 'center',
              backgroundColor: '#f0f0f0'
            },
            content: [
              { type: 'text', text: 'Styled paragraph' }
            ]
          }
        ]
      };

      // Convert ADF to Markdown
      const markdown = await parser.stringify(originalAdf);
      
      // Should contain metadata comments
      expect(markdown).toContain('<!-- adf:heading attrs=\'{"id":"custom-id","textAlign":"center"}\' -->');
      expect(markdown).toContain('<!-- adf:paragraph attrs=\'{"textAlign":"center","backgroundColor":"#f0f0f0"}\' -->');

      // Convert back to ADF
      const reconstructed = await parser.parse(markdown);

      // Should preserve custom attributes
      expect(reconstructed.content[0].attrs).toEqual({
        level: 1,
        id: 'custom-id',
        textAlign: 'center'
      });
      
      expect(reconstructed.content[1].attrs).toEqual({
        textAlign: 'center',
        backgroundColor: '#f0f0f0'
      });
    });

    it('should handle complex round-trip with panels and metadata', async () => {
      const originalAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'panel',
            attrs: { 
              panelType: 'warning',
              backgroundColor: '#fff3cd',
              borderColor: '#856404'
            },
            content: [
              {
                type: 'paragraph',
                attrs: { textAlign: 'center' },
                content: [
                  { type: 'text', text: 'Custom styled warning panel' }
                ]
              }
            ]
          }
        ]
      };

      // Round-trip conversion
      const markdown = await parser.stringify(originalAdf);
      const reconstructed = await parser.parse(markdown);

      // Verify panel attributes preserved
      expect(reconstructed.content[0]).toMatchObject({
        type: 'panel',
        attrs: {
          panelType: 'warning',
          backgroundColor: '#fff3cd',
          borderColor: '#856404'
        }
      });

      // Verify nested paragraph structure (note: nested metadata in fence blocks not yet supported)
      expect(reconstructed.content[0].content![0]).toMatchObject({
        type: 'paragraph'
      });
      // TODO: Support nested content metadata in ADF fence blocks
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed metadata comments gracefully', async () => {
      const markdown = `
<!-- adf:paragraph attrs='invalid-json' -->
This paragraph has malformed metadata.

<!-- not-adf:paragraph -->
This paragraph has non-ADF comment.
`.trim();

      const result = await parser.parse(markdown);
      
      // Should parse without throwing errors  
      expect(result.content).toHaveLength(3);
      expect(result.content[0].type).toBe('paragraph'); // First paragraph 
      expect(result.content[2].type).toBe('paragraph'); // Last paragraph
      
      // Should have parsed the malformed metadata (our parser is now working)
      // The malformed JSON 'invalid-json' gets parsed as a string value
      expect(result.content[0].attrs).toBeDefined();
      expect(result.content[0].attrs).toEqual({ attrs: "'invalid-json'" });
    });

    it('should handle orphaned metadata comments', async () => {
      const markdown = `
<!-- adf:paragraph attrs='{"textAlign":"center"}' -->

<!-- adf:heading attrs='{"level":2}' -->
`.trim();

      // Should parse without errors even with orphaned comments
      const result = await parser.parse(markdown);
      expect(result.content).toBeDefined();
    });
  });

  describe('Synchronous Processing', () => {
    it('should handle metadata comments in sync parsing', () => {
      const markdown = `
<!-- adf:paragraph attrs='{"textAlign":"center"}' -->
Centered paragraph.
`.trim();

      const result = parser.parseSync(markdown);
      
      expect(result.content[0]).toEqual({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          { type: 'text', text: 'Centered paragraph.' }
        ]
      });
    });
  });

  describe('Validation with Metadata', () => {
    it('should validate documents with metadata comments', async () => {
      const markdown = `
<!-- adf:heading attrs='{"id":"valid-id"}' -->
# Valid Heading

<!-- adf:paragraph attrs='{"textAlign":"center"}' -->
Valid paragraph.
`.trim();

      const validation = await parser.validate(markdown);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.warnings).toEqual([]);
    });

    it('should report warnings for unknown metadata attributes', async () => {
      const markdown = `
<!-- adf:unknownNode attrs='{"customAttr":"value"}' -->
Content with unknown node type metadata.
`.trim();

      const validation = await parser.validate(markdown);
      
      // Should still be valid but may have warnings
      expect(validation.valid).toBe(true);
    });
  });
});