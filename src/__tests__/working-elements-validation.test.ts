/**
 * @file working-elements-validation.test.ts
 * @description Tests for elements that actually work correctly in both directions
 */

import { Parser } from '../index.js';

describe('Working Elements Validation Tests', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser({ enableAdfExtensions: true });
  });

  describe('WORKING ELEMENTS - Document Structure', () => {
    it('should convert document to proper ADF doc node', async () => {
      const markdown = 'Simple document content';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.type).toBe('doc');
      expect(result.version).toBe(1);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('paragraph');
    });

    it('should convert paragraph to proper ADF paragraph node', async () => {
      const markdown = 'This is a paragraph.';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('paragraph');
      expect(result.content[0].content[0].type).toBe('text');
      expect(result.content[0].content[0].text).toBe('This is a paragraph.');
    });

    it('should convert hard breaks to proper ADF hardBreak nodes', async () => {
      const markdown = 'Line one\\\nLine two';
      const result = await parser.markdownToAdf(markdown);
      
      const paragraph = result.content[0];
      expect(paragraph.type).toBe('paragraph');
      expect(paragraph.content).toHaveLength(3);
      expect(paragraph.content[0].type).toBe('text');
      expect(paragraph.content[1].type).toBe('hardBreak');
      expect(paragraph.content[2].type).toBe('text');
    });
  });

  describe('WORKING ELEMENTS - Headings (All Levels)', () => {
    it('should convert all heading levels to proper ADF heading nodes', async () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content).toHaveLength(6);
      
      for (let i = 0; i < 6; i++) {
        const heading = result.content[i];
        expect(heading.type).toBe('heading');
        expect(heading.attrs.level).toBe(i + 1);
        expect(heading.content[0].text).toBe(`Heading ${i + 1}`);
      }
    });
  });

  describe('WORKING ELEMENTS - Text Formatting Marks', () => {
    it('should convert bold text to strong mark', async () => {
      const markdown = '**bold text**';
      const result = await parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('bold text');
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type).toBe('strong');
    });

    it('should convert italic text to em mark', async () => {
      const markdown = '*italic text*';
      const result = await parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks[0].type).toBe('em');
    });

    it('should convert inline code to code mark', async () => {
      const markdown = '`inline code`';
      const result = await parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks[0].type).toBe('code');
    });

    it('should convert strikethrough to strike mark', async () => {
      const markdown = '~~strikethrough text~~';
      const result = await parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks[0].type).toBe('strike');
    });

    it('should convert links to link marks', async () => {
      const markdown = '[Link Text](https://example.com)';
      const result = await parser.markdownToAdf(markdown);
      
      const textNode = result.content[0].content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.marks[0].type).toBe('link');
      expect(textNode.marks[0].attrs.href).toBe('https://example.com');
    });
  });

  describe('WORKING ELEMENTS - Lists', () => {
    it('should convert bullet lists to proper ADF bulletList nodes', async () => {
      const markdown = `- Item 1
- Item 2
- Item 3`;

      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('bulletList');
      expect(result.content[0].content).toHaveLength(3);
      
      result.content[0].content.forEach((item: any, index: number) => {
        expect(item.type).toBe('listItem');
        expect(item.content[0].type).toBe('paragraph');
        expect(item.content[0].content[0].text).toBe(`Item ${index + 1}`);
      });
    });

    it('should convert ordered lists to proper ADF orderedList nodes', async () => {
      const markdown = `1. First item
2. Second item
3. Third item`;

      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('orderedList');
      expect(result.content[0].content).toHaveLength(3);
      
      result.content[0].content.forEach((item: any, index: number) => {
        expect(item.type).toBe('listItem');
        expect(item.content[0].type).toBe('paragraph');
        expect(item.content[0].content[0].text).toBe(`${index === 0 ? 'First' : index === 1 ? 'Second' : 'Third'} item`);
      });
    });
  });

  describe('WORKING ELEMENTS - Tables', () => {
    it('should convert tables to proper ADF table structure', async () => {
      const markdown = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |`;

      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('table');
      
      const table = result.content[0];
      expect(table.content).toHaveLength(3); // header + 2 data rows
      
      // Check header row
      const headerRow = table.content[0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[0].content[0].text).toBe('Header 1');
      
      // Check data rows
      const dataRow = table.content[1];
      expect(dataRow.type).toBe('tableRow');
      expect(dataRow.content[0].type).toBe('tableCell');
      expect(dataRow.content[0].content[0].text).toBe('Data 1');
    });
  });

  describe('WORKING ELEMENTS - Quotes & Code', () => {
    it('should convert blockquotes to proper ADF blockquote nodes', async () => {
      const markdown = '> This is a blockquote\n> with multiple lines';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('blockquote');
      expect(result.content[0].content[0].type).toBe('paragraph');
    });

    it('should convert code blocks to proper ADF codeBlock nodes', async () => {
      const markdown = '```javascript\nconst example = "code";\n```';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('codeBlock');
      expect(result.content[0].attrs.language).toBe('javascript');
      expect(result.content[0].content[0].type).toBe('text');
      expect(result.content[0].content[0].text).toBe('const example = "code";');
    });

    it('should convert horizontal rules to proper ADF rule nodes', async () => {
      const markdown = '---';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('rule');
    });
  });

  describe('WORKING ELEMENTS - ADF Panels (All Types)', () => {
    it('should convert info panels to proper ADF panel nodes', async () => {
      const markdown = `~~~panel type=info title="Information"
This is an info panel.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('info');
    });

    it('should convert warning panels to proper ADF panel nodes', async () => {
      const markdown = `~~~panel type=warning title="Warning"
This is a warning panel.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('warning');
    });

    it('should convert error panels to proper ADF panel nodes', async () => {
      const markdown = `~~~panel type=error title="Error"
This is an error panel.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('error');
    });

    it('should convert success panels to proper ADF panel nodes', async () => {
      const markdown = `~~~panel type=success title="Success"
This is a success panel.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('success');
    });

    it('should convert note panels to proper ADF panel nodes', async () => {
      const markdown = `~~~panel type=note title="Note"
This is a note panel.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('note');
    });
  });

  describe('WORKING ELEMENTS - Interactive Elements', () => {
    it('should convert expand sections to proper ADF expand nodes', async () => {
      const markdown = `~~~expand title="Click to expand"
Hidden content here.
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('expand');
      expect(result.content[0].attrs.title).toBe('Click to expand');
    });
  });

  describe('WORKING ELEMENTS - Media Elements (Some Working)', () => {
    it('should convert media single blocks to proper ADF mediaSingle nodes', async () => {
      const markdown = `~~~mediaSingle layout=center width=80
![Description](media:media-id-123)
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('mediaSingle');
      expect(result.content[0].attrs.layout).toBe('center');
      expect(result.content[0].attrs.width).toBe(80);
    });
  });

  describe('WORKING ELEMENTS - Complex Nested Structures', () => {
    it('should handle nested lists inside panels', async () => {
      const markdown = `~~~panel type=info title="Requirements"
Before installing:

- Node.js 16+
- npm 7+
- Git installed
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('info');
      
      // Should contain paragraph and bulletList
      const panelContent = result.content[0].content;
      expect(panelContent.some((node: any) => node.type === 'bulletList')).toBeTruthy();
    });

    it('should handle expand sections with mixed content', async () => {
      const markdown = `~~~expand title="Technical Details"
## Subsection

This includes:
- Technical specifications
- \`Code examples\`
- **Important notes**

\`\`\`bash
npm install package
\`\`\`
~~~`;
      
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content[0].type).toBe('expand');
      expect(result.content[0].attrs.title).toBe('Technical Details');
      
      const expandContent = result.content[0].content;
      expect(expandContent.some((node: any) => node.type === 'heading')).toBeTruthy();
      expect(expandContent.some((node: any) => node.type === 'bulletList')).toBeTruthy();
      expect(expandContent.some((node: any) => node.type === 'codeBlock')).toBeTruthy();
    });
  });

  describe('WORKING ELEMENTS - Frontmatter and Metadata', () => {
    it('should handle frontmatter data', async () => {
      const markdown = `---
title: "Test Document"
author: "Test Author"
tags: [test, markdown, adf]
---

# Document Content`;

      const result = await parser.markdownToAdf(markdown);
      
      // Document structure should be preserved
      expect(result.type).toBe('doc');
      expect(result.content[0].type).toBe('heading');
    });
  });

  describe('WORKING ELEMENTS - Edge Cases and Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const markdown = '';
      const result = await parser.markdownToAdf(markdown);
      
      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(0);
    });

    it('should handle mixed markdown and ADF syntax', async () => {
      const markdown = `# Standard Heading

Regular **markdown** paragraph.

~~~panel type=info title="ADF Panel"
Mixed content with *formatting*.
~~~

Another regular paragraph with \`inline code\`.`;

      const result = await parser.markdownToAdf(markdown);
      
      expect(result.content).toHaveLength(4);
      expect(result.content[0].type).toBe('heading');
      expect(result.content[1].type).toBe('paragraph');
      expect(result.content[2].type).toBe('panel');
      expect(result.content[3].type).toBe('paragraph');
    });
  });
});