/**
 * @file table-panel-conversion.test.ts
 * @description Comprehensive tests for table and panel conversion to verify proper ADF node generation.
 * Uses ASTBuilder + MarkdownTokenizer directly to avoid ESM-only unified dependency.
 */

import { ASTBuilder } from '../parser/markdown-to-adf/ASTBuilder.js';
import { MarkdownTokenizer } from '../parser/markdown-to-adf/MarkdownTokenizer.js';

/**
 * Helper: tokenize markdown and build ADF document using the direct tokenizer path.
 */
function parseMarkdown(markdown: string) {
  const tokenizer = new MarkdownTokenizer();
  const builder = new ASTBuilder();
  const tokens = tokenizer.tokenize(markdown);
  return builder.buildADF(tokens);
}

describe('Table and Panel Conversion Tests', () => {
  describe('Table Conversion', () => {
    it('should convert simple markdown table to proper ADF table node', () => {
      const markdown = `
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |
      `.trim();

      const result = parseMarkdown(markdown);

      // Should have one table node
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('table');

      const table = result.content[0];

      // Table should have 3 rows (header + 2 data rows)
      expect(table.content).toHaveLength(3);

      // First row should be table headers
      const headerRow = table.content[0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content).toHaveLength(2);
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[1].type).toBe('tableHeader');

      // Check header content - cells wrap inline content in paragraph nodes per ADF spec
      expect(headerRow.content[0].content[0].type).toBe('paragraph');
      expect(headerRow.content[0].content[0].content[0].text).toBe('Column 1');
      expect(headerRow.content[1].content[0].type).toBe('paragraph');
      expect(headerRow.content[1].content[0].content[0].text).toBe('Column 2');

      // Data rows should be table cells
      const dataRow1 = table.content[1];
      expect(dataRow1.type).toBe('tableRow');
      expect(dataRow1.content[0].type).toBe('tableCell');
      expect(dataRow1.content[1].type).toBe('tableCell');

      // Check data content - cells wrap inline content in paragraph nodes per ADF spec
      expect(dataRow1.content[0].content[0].type).toBe('paragraph');
      expect(dataRow1.content[0].content[0].content[0].text).toBe('Data 1');
      expect(dataRow1.content[1].content[0].type).toBe('paragraph');
      expect(dataRow1.content[1].content[0].content[0].text).toBe('Data 2');
    });

    it('should wrap table cell content in paragraph nodes per ADF spec', () => {
      const markdown = `
| a | b |
|---|---|
| c |   |
      `.trim();

      const result = parseMarkdown(markdown);
      const table = result.content[0];

      // Header cells should contain paragraph children
      const headerRow = table.content[0];
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[0].content[0].type).toBe('paragraph');
      expect(headerRow.content[0].content[0].content[0].type).toBe('text');

      expect(headerRow.content[1].type).toBe('tableHeader');
      expect(headerRow.content[1].content[0].type).toBe('paragraph');
      expect(headerRow.content[1].content[0].content[0].type).toBe('text');

      // Data cells should contain paragraph children
      const dataRow = table.content[1];
      expect(dataRow.content[0].type).toBe('tableCell');
      expect(dataRow.content[0].content[0].type).toBe('paragraph');
      expect(dataRow.content[0].content[0].content[0].text).toBe('c');

      // Empty cells should have paragraph with empty content
      expect(dataRow.content[1].type).toBe('tableCell');
      expect(dataRow.content[1].content[0].type).toBe('paragraph');
    });

    it('should NOT convert table to paragraph node with raw text', () => {
      const markdown = `
| Component | Version |
|-----------|---------|
| Node.js   | 18.0.0+ |
      `.trim();

      const result = parseMarkdown(markdown);

      // Should be a table node, not a paragraph
      expect(result.content[0].type).not.toBe('paragraph');
      expect(result.content[0].type).toBe('table');

      // Should not contain raw markdown text
      const tableNode = result.content[0];
      const hasRawMarkdown = JSON.stringify(tableNode).includes('|');
      expect(hasRawMarkdown).toBe(false);
    });

    it('should handle table with basic content structure', () => {
      const markdown = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('table');
      const table = result.content[0];

      // Check that table has proper structure
      expect(table.content).toHaveLength(2); // header row + data row
      const headerRow = table.content[0];
      const dataRow = table.content[1];

      // Check header row
      expect(headerRow.content).toHaveLength(3);
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[0].content[0].type).toBe('paragraph');
      expect(headerRow.content[0].content[0].content[0].text).toBe('Header 1');

      // Check data row
      expect(dataRow.content).toHaveLength(3);
      expect(dataRow.content[0].type).toBe('tableCell');
      expect(dataRow.content[0].content[0].type).toBe('paragraph');
      expect(dataRow.content[0].content[0].content[0].text).toBe('Data 1');
    });
  });

  describe('Panel Conversion', () => {
    it('should convert info panel to proper ADF panel node', () => {
      const markdown = `
~~~panel type=info title="Information"
This is an info panel with important information.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      // Should have one panel node
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('panel');

      const panel = result.content[0];

      // Check panel attributes
      expect(panel.attrs).toBeDefined();
      expect(panel.attrs.panelType).toBe('info');

      // Check panel content
      expect(panel.content).toHaveLength(1);
      expect(panel.content[0].type).toBe('paragraph');
      expect(panel.content[0].content[0].text).toContain('This is an info panel');
    });

    it('should convert warning panel to proper ADF panel node', () => {
      const markdown = `
~~~panel type=warning title="Warning"
This is a warning message.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('warning');
    });

    it('should convert success panel to proper ADF panel node', () => {
      const markdown = `
~~~panel type=success title="Success"
Operation completed successfully!
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('success');
    });

    it('should convert error panel to proper ADF panel node', () => {
      const markdown = `
~~~panel type=error title="Error"
Something went wrong!
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('error');
    });

    it('should NOT convert panel to codeBlock node', () => {
      const markdown = `
~~~panel type=info title="Test"
This should be a panel, not a code block.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      // Should be a panel node, not a codeBlock
      expect(result.content[0].type).not.toBe('codeBlock');
      expect(result.content[0].type).toBe('panel');

      // Should not have language property (which codeBlock would have)
      expect(result.content[0].attrs).not.toHaveProperty('language');
      expect(result.content[0].attrs).toHaveProperty('panelType');
    });

    it('should handle panel with multiple paragraphs', () => {
      const markdown = `
~~~panel type=note title="Multiple Paragraphs"
First paragraph in the panel.

Second paragraph in the panel.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      const panel = result.content[0];
      expect(panel.type).toBe('panel');
      expect(panel.content.length).toBeGreaterThan(1); // Multiple paragraphs
    });
  });

  describe('Expand Section Conversion', () => {
    it('should convert expand section to proper ADF expand node', () => {
      const markdown = `
~~~expand title="Click to expand"
Hidden content goes here.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('expand');
      expect(result.content[0].attrs.title).toBe('Click to expand');
    });

    it('should NOT convert expand to codeBlock node', () => {
      const markdown = `
~~~expand title="Troubleshooting"
Detailed troubleshooting steps.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).not.toBe('codeBlock');
      expect(result.content[0].type).toBe('expand');
    });
  });

  describe('Mixed Content Conversion', () => {
    it('should handle document with both tables and panels', () => {
      const markdown = `# Requirements

~~~panel type=info title="Prerequisites"
Before installing, ensure your system meets these requirements.
~~~

| Component | Version |
|-----------|---------|
| Node.js   | 18.0.0+ |
| npm       | 8.0.0+  |

~~~panel type=success title="Success"
Installation completed successfully!
~~~`;

      const result = parseMarkdown(markdown);

      // Should have multiple nodes: heading, panel, table, panel
      expect(result.content.length).toBeGreaterThan(3);

      // Find and verify each type
      const heading = result.content.find((node: any) => node.type === 'heading');
      const panels = result.content.filter((node: any) => node.type === 'panel');
      const table = result.content.find((node: any) => node.type === 'table');

      expect(heading).toBeDefined();
      expect(panels).toHaveLength(2);
      expect(table).toBeDefined();

      // Verify panel types
      expect(panels[0].attrs.panelType).toBe('info');
      expect(panels[1].attrs.panelType).toBe('success');
    });
  });

  describe('Table inside Panel (parseTableFromLines code path)', () => {
    it('should wrap table cell content in paragraph nodes when table is inside a panel', () => {
      const markdown = `~~~panel type=info title="Details"
| Header | Value |
|--------|-------|
| key    | val   |
~~~`;

      const result = parseMarkdown(markdown);

      // Top-level node should be a panel
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('panel');

      const panel = result.content[0];

      // Panel content should contain a table
      const table = panel.content.find((node: any) => node.type === 'table');
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(2); // header row + data row

      // Header row
      const headerRow = table.content[0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content).toHaveLength(2);

      // Header cells should be wrapped in paragraph nodes
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[0].content[0].type).toBe('paragraph');
      expect(headerRow.content[0].content[0].content[0].text).toBe('Header');

      expect(headerRow.content[1].type).toBe('tableHeader');
      expect(headerRow.content[1].content[0].type).toBe('paragraph');
      expect(headerRow.content[1].content[0].content[0].text).toBe('Value');

      // Data row
      const dataRow = table.content[1];
      expect(dataRow.type).toBe('tableRow');
      expect(dataRow.content).toHaveLength(2);

      // Data cells should be wrapped in paragraph nodes
      expect(dataRow.content[0].type).toBe('tableCell');
      expect(dataRow.content[0].content[0].type).toBe('paragraph');
      expect(dataRow.content[0].content[0].content[0].text).toBe('key');

      expect(dataRow.content[1].type).toBe('tableCell');
      expect(dataRow.content[1].content[0].type).toBe('paragraph');
      expect(dataRow.content[1].content[0].content[0].text).toBe('val');
    });

    it('should wrap table cell content in paragraph nodes for multi-row table inside a panel', () => {
      const markdown = `~~~panel type=warning title="Status"
| Service | Status  | Uptime |
|---------|---------|--------|
| API     | Running | 99.9%  |
| DB      | Stopped | 0%     |
~~~`;

      const result = parseMarkdown(markdown);

      const panel = result.content[0];
      expect(panel.type).toBe('panel');

      const table = panel.content.find((node: any) => node.type === 'table');
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(3); // header + 2 data rows

      // Verify all header cells have paragraph wrapping
      const headerRow = table.content[0];
      expect(headerRow.content).toHaveLength(3);
      for (const headerCell of headerRow.content) {
        expect(headerCell.type).toBe('tableHeader');
        expect(headerCell.content[0].type).toBe('paragraph');
      }
      expect(headerRow.content[0].content[0].content[0].text).toBe('Service');
      expect(headerRow.content[1].content[0].content[0].text).toBe('Status');
      expect(headerRow.content[2].content[0].content[0].text).toBe('Uptime');

      // Verify all data cells have paragraph wrapping
      const dataRow1 = table.content[1];
      for (const cell of dataRow1.content) {
        expect(cell.type).toBe('tableCell');
        expect(cell.content[0].type).toBe('paragraph');
      }
      expect(dataRow1.content[0].content[0].content[0].text).toBe('API');
      expect(dataRow1.content[1].content[0].content[0].text).toBe('Running');
      expect(dataRow1.content[2].content[0].content[0].text).toBe('99.9%');

      const dataRow2 = table.content[2];
      for (const cell of dataRow2.content) {
        expect(cell.type).toBe('tableCell');
        expect(cell.content[0].type).toBe('paragraph');
      }
      expect(dataRow2.content[0].content[0].content[0].text).toBe('DB');
      expect(dataRow2.content[1].content[0].content[0].text).toBe('Stopped');
      expect(dataRow2.content[2].content[0].content[0].text).toBe('0%');
    });
  });

  describe('Table inside Expand (parseTableFromLines code path)', () => {
    it('should wrap table cell content in paragraph nodes when table is inside an expand', () => {
      const markdown = `~~~expand title="Click to expand"
| Header | Value |
|--------|-------|
| key    | val   |
~~~`;

      const result = parseMarkdown(markdown);

      // Top-level node should be an expand
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('expand');

      const expand = result.content[0];

      // Expand content should contain a table
      const table = expand.content.find((node: any) => node.type === 'table');
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(2); // header row + data row

      // Header row
      const headerRow = table.content[0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content).toHaveLength(2);

      // Header cells should be wrapped in paragraph nodes
      expect(headerRow.content[0].type).toBe('tableHeader');
      expect(headerRow.content[0].content[0].type).toBe('paragraph');
      expect(headerRow.content[0].content[0].content[0].text).toBe('Header');

      expect(headerRow.content[1].type).toBe('tableHeader');
      expect(headerRow.content[1].content[0].type).toBe('paragraph');
      expect(headerRow.content[1].content[0].content[0].text).toBe('Value');

      // Data row
      const dataRow = table.content[1];
      expect(dataRow.type).toBe('tableRow');
      expect(dataRow.content).toHaveLength(2);

      // Data cells should be wrapped in paragraph nodes
      expect(dataRow.content[0].type).toBe('tableCell');
      expect(dataRow.content[0].content[0].type).toBe('paragraph');
      expect(dataRow.content[0].content[0].content[0].text).toBe('key');

      expect(dataRow.content[1].type).toBe('tableCell');
      expect(dataRow.content[1].content[0].type).toBe('paragraph');
      expect(dataRow.content[1].content[0].content[0].text).toBe('val');
    });

    it('should wrap table cell content in paragraph nodes for multi-row table inside an expand', () => {
      const markdown = `~~~expand title="Configuration"
| Setting | Default | Description  |
|---------|---------|--------------|
| timeout | 30s     | Max wait     |
| retries | 3       | Retry count  |
~~~`;

      const result = parseMarkdown(markdown);

      const expand = result.content[0];
      expect(expand.type).toBe('expand');

      const table = expand.content.find((node: any) => node.type === 'table');
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(3); // header + 2 data rows

      // Verify all header cells have paragraph wrapping
      const headerRow = table.content[0];
      expect(headerRow.content).toHaveLength(3);
      for (const headerCell of headerRow.content) {
        expect(headerCell.type).toBe('tableHeader');
        expect(headerCell.content[0].type).toBe('paragraph');
      }
      expect(headerRow.content[0].content[0].content[0].text).toBe('Setting');
      expect(headerRow.content[1].content[0].content[0].text).toBe('Default');
      expect(headerRow.content[2].content[0].content[0].text).toBe('Description');

      // Verify all data cells have paragraph wrapping
      const dataRow1 = table.content[1];
      for (const cell of dataRow1.content) {
        expect(cell.type).toBe('tableCell');
        expect(cell.content[0].type).toBe('paragraph');
      }
      expect(dataRow1.content[0].content[0].content[0].text).toBe('timeout');
      expect(dataRow1.content[1].content[0].content[0].text).toBe('30s');
      expect(dataRow1.content[2].content[0].content[0].text).toBe('Max wait');

      const dataRow2 = table.content[2];
      for (const cell of dataRow2.content) {
        expect(cell.type).toBe('tableCell');
        expect(cell.content[0].type).toBe('paragraph');
      }
      expect(dataRow2.content[0].content[0].content[0].text).toBe('retries');
      expect(dataRow2.content[1].content[0].content[0].text).toBe('3');
      expect(dataRow2.content[2].content[0].content[0].text).toBe('Retry count');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty table cells', () => {
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Value    |          |
|          | Value    |
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('table');
      const table = result.content[0];

      // Should handle empty cells gracefully
      expect(table.content).toHaveLength(3); // header + 2 data rows
    });

    it('should handle panel with no title', () => {
      const markdown = `
~~~panel type=info
Panel content without a title.
~~~
      `.trim();

      const result = parseMarkdown(markdown);

      expect(result.content[0].type).toBe('panel');
      expect(result.content[0].attrs.panelType).toBe('info');
    });
  });
});
