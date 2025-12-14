/**
 * @file ASTBuilder.block-parsing.test.ts
 * @description Comprehensive tests for block content parsing in expand/panel blocks
 * Tests the enhanced parseBlockContent method that handles all markdown block elements
 */

import { ASTBuilder } from '../../../src/parser/markdown-to-adf/ASTBuilder.js';
import { MarkdownTokenizer } from '../../../src/parser/markdown-to-adf/MarkdownTokenizer.js';
import { ADFDocument } from '../../../src/types/adf.types.js';

describe('ASTBuilder Block Content Parsing', () => {
  let builder: ASTBuilder;
  let tokenizer: MarkdownTokenizer;

  beforeEach(() => {
    builder = new ASTBuilder();
    tokenizer = new MarkdownTokenizer();
  });

  describe('Tables in Expand Blocks', () => {
    it('should parse tables with social elements in expand blocks', () => {
      const markdown = `~~~expand title="Pipeline Status"

| Stage | Owner | Status |
|-------|-------|--------|
| Build | {user:builder} | {status:active} |
| Test | {user:tester} | {status:pending} |

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      
      const expandContent = adf.content[0].content || [];
      const table = expandContent.find((node: any) => node.type === 'table');
      
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(3); // Header + 2 data rows
      
      // Check first data row
      const firstDataRow = table.content[1];
      expect(firstDataRow.type).toBe('tableRow');
      
      // Check Owner cell (index 1) contains mention
      const ownerCell = firstDataRow.content[1];
      const mentionNode = ownerCell.content.find((node: any) => node.type === 'mention');
      expect(mentionNode).toBeDefined();
      expect(mentionNode.attrs.id).toBe('builder');
      
      // Check Status cell (index 2) contains status
      const statusCell = firstDataRow.content[2];
      const statusNode = statusCell.content.find((node: any) => node.type === 'status');
      expect(statusNode).toBeDefined();
      expect(statusNode.attrs.text).toBe('active');
    });

    it('should handle complex table scenarios in expand blocks', () => {
      const markdown = `~~~expand title="🚀 CI/CD Pipeline Configuration - Managed by {user:devops.lead}"

**Pipeline Stages:**

| Stage | Duration | Owner | Status | Last Run |
|-------|----------|-------|--------|----------|
| Build | 3 min | {user:build.engineer} | {status:active} | {date:2024-01-30} |
| Deploy | 2 min | {user:deploy.manager} | {status:manual} | {date:2024-01-29} |

**Additional Info:**
Pipeline runs daily at midnight.

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      
      // Should have: paragraph (Pipeline Stages), table, paragraph (Additional Info), paragraph (Pipeline runs)
      expect(expandContent.length).toBeGreaterThanOrEqual(3);
      
      const table = expandContent.find((node: any) => node.type === 'table');
      expect(table).toBeDefined();
      expect(table.content).toHaveLength(3); // Header + 2 data rows
      
      // Verify social elements in table cells
      const firstDataRow = table.content[1];
      const mentionCell = firstDataRow.content[2];
      const statusCell = firstDataRow.content[3]; 
      const dateCell = firstDataRow.content[4];
      
      expect(mentionCell.content.some((n: any) => n.type === 'mention')).toBeTruthy();
      expect(statusCell.content.some((n: any) => n.type === 'status')).toBeTruthy();
      expect(dateCell.content.some((n: any) => n.type === 'date')).toBeTruthy();
    });
  });

  describe('Headings in Expand Blocks', () => {
    it('should parse headings in expand blocks', () => {
      const markdown = `~~~expand title="Documentation"

# Main Heading with {user:author}

## Sub Heading :star:

### Level 3 Heading

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const headings = expandContent.filter((node: any) => node.type === 'heading');
      
      expect(headings).toHaveLength(3);
      
      // Check main heading
      const mainHeading = headings[0];
      expect(mainHeading.attrs.level).toBe(1);
      const mention = mainHeading.content.find((node: any) => node.type === 'mention');
      expect(mention).toBeDefined();
      expect(mention.attrs.id).toBe('author');
      
      // Check sub heading 
      const subHeading = headings[1];
      expect(subHeading.attrs.level).toBe(2);
      const emoji = subHeading.content.find((node: any) => node.type === 'emoji');
      expect(emoji).toBeDefined();
      expect(emoji.attrs.shortName).toBe(':star:');
      // Unicode emojis don't have id field per Atlassian docs
      expect(emoji.attrs.id).toBeUndefined();
      expect(emoji.attrs.text).toBe('⭐');
      
      // Check level 3 heading
      const level3Heading = headings[2];
      expect(level3Heading.attrs.level).toBe(3);
    });
  });

  describe('Lists in Expand Blocks', () => {
    it('should parse bullet lists in expand blocks', () => {
      const markdown = `~~~expand title="Team Members"

**Frontend Team:**

- Lead: {user:frontend.lead} :star:
- Developer: {user:frontend.dev} {status:active}
- Designer: {user:ui.designer} {status:available}

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const bulletList = expandContent.find((node: any) => node.type === 'bulletList');
      
      expect(bulletList).toBeDefined();
      expect(bulletList.content).toHaveLength(3); // 3 list items
      
      // Check first list item
      const firstItem = bulletList.content[0];
      const firstItemContent = firstItem.content[0].content; // listItem > paragraph > content
      
      const mention = firstItemContent.find((node: any) => node.type === 'mention');
      const emoji = firstItemContent.find((node: any) => node.type === 'emoji');
      
      expect(mention).toBeDefined();
      expect(mention.attrs.id).toBe('frontend.lead');
      expect(emoji).toBeDefined();
      expect(emoji.attrs.shortName).toBe(':star:');
      // Unicode emojis don't have id field per Atlassian docs
      expect(emoji.attrs.id).toBeUndefined();
      expect(emoji.attrs.text).toBe('⭐');
    });

    it('should parse ordered lists in expand blocks', () => {
      const markdown = `~~~expand title="Process Steps"

**Deployment Process:**

1. Build application ({user:build.engineer})
2. Run tests ({status:automated})
3. Deploy to staging ({date:2024-01-30})
4. Manual approval required
5. Deploy to production

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const orderedList = expandContent.find((node: any) => node.type === 'orderedList');
      
      expect(orderedList).toBeDefined();
      expect(orderedList.content).toHaveLength(5); // 5 list items
      
      // Check social elements across list items
      const listStr = JSON.stringify(orderedList.content);
      expect(listStr).toContain('"type":"mention"');
      expect(listStr).toContain('"type":"status"');
      expect(listStr).toContain('"type":"date"');
    });
  });

  describe('Code Blocks in Expand Blocks', () => {
    it('should parse code blocks in expand blocks', () => {
      const markdown = `~~~expand title="Configuration"

**Database Setup:**

\`\`\`sql
SELECT * FROM users 
WHERE status = 'active'
\`\`\`

**API Configuration:**

\`\`\`javascript
const config = {
  apiKey: process.env.API_KEY,
  endpoint: 'https://api.example.com'
};
\`\`\`

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const codeBlocks = expandContent.filter((node: any) => node.type === 'codeBlock');
      
      expect(codeBlocks).toHaveLength(2);
      
      // Check SQL code block
      const sqlBlock = codeBlocks[0];
      expect(sqlBlock.attrs.language).toBe('sql');
      expect(sqlBlock.content[0].text).toContain('SELECT * FROM users');
      
      // Check JavaScript code block
      const jsBlock = codeBlocks[1];
      expect(jsBlock.attrs.language).toBe('javascript');
      expect(jsBlock.content[0].text).toContain('const config');
    });

    it('should parse code blocks without language', () => {
      const markdown = `~~~expand title="Plain Code"

\`\`\`
plain code here
no language specified
\`\`\`

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const codeBlock = expandContent.find((node: any) => node.type === 'codeBlock');
      
      expect(codeBlock).toBeDefined();
      expect(codeBlock.attrs).toBeUndefined(); // No language attribute
      expect(codeBlock.content[0].text).toBe('plain code here\nno language specified');
    });
  });

  describe('Blockquotes in Expand Blocks', () => {
    it('should parse blockquotes in expand blocks', () => {
      const markdown = `~~~expand title="Important Notes"

**Security Notice:**

> This system is managed by {user:security.admin}
> Current threat level: {status:low}  
> Last updated: {date:2024-01-30}

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const blockquote = expandContent.find((node: any) => node.type === 'blockquote');
      
      expect(blockquote).toBeDefined();
      expect(blockquote.content).toHaveLength(1); // Should have one paragraph
      
      const paragraphContent = blockquote.content[0].content;
      const mention = paragraphContent.find((node: any) => node.type === 'mention');
      const status = paragraphContent.find((node: any) => node.type === 'status');
      const date = paragraphContent.find((node: any) => node.type === 'date');
      
      expect(mention).toBeDefined();
      expect(mention.attrs.id).toBe('security.admin');
      expect(status).toBeDefined();
      expect(status.attrs.text).toBe('low');
      expect(date).toBeDefined();
      // Date should be converted to Unix timestamp (2024-01-30 00:00:00 UTC)
      const expectedTimestamp = new Date('2024-01-30T00:00:00.000Z').getTime().toString();
      expect(date.attrs.timestamp).toBe(expectedTimestamp);
    });
  });

  describe('Horizontal Rules in Expand Blocks', () => {
    it('should parse horizontal rules in expand blocks', () => {
      const markdown = `~~~expand title="Document Sections"

Section 1 content

---

Section 2 content

***

Section 3 content

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      const rules = expandContent.filter((node: any) => node.type === 'rule');
      
      expect(rules).toHaveLength(2);
      
      // Rules should be standalone nodes
      rules.forEach((rule: any) => {
        expect(rule.type).toBe('rule');
        expect(rule.attrs).toBeUndefined(); // Rules don't have attributes
      });
    });
  });

  describe('Mixed Content in Expand Blocks', () => {
    it('should handle all block types together in expand blocks', () => {
      const markdown = `~~~expand title="Comprehensive Documentation by {user:doc.author}"

# Project Overview

This project is managed by {user:project.manager} :rocket:

## Team Structure

**Team Members:**

- Frontend: {user:frontend.dev}
- Backend: {user:backend.dev}
- QA: {user:qa.engineer}

## Status Table

| Component | Owner | Status | Last Updated |
|-----------|-------|--------|--------------|
| Frontend | {user:frontend.dev} | {status:active} | {date:2024-01-30} |
| Backend | {user:backend.dev} | {status:completed} | {date:2024-01-29} |

## Configuration

\`\`\`yaml
environment: production
debug: false
\`\`\`

> **Important**: Managed by {user:admin} {status:live}

---

## Process Steps

1. Development phase
2. Testing phase
3. Deployment phase

Final notes here.

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const expandContent = adf.content[0].content || [];
      
      // Should contain various node types
      const nodeTypes = expandContent.map((node: any) => node.type);
      
      expect(nodeTypes).toContain('heading');
      expect(nodeTypes).toContain('paragraph');
      expect(nodeTypes).toContain('bulletList');
      expect(nodeTypes).toContain('table');
      expect(nodeTypes).toContain('codeBlock');
      expect(nodeTypes).toContain('blockquote');
      expect(nodeTypes).toContain('rule');
      expect(nodeTypes).toContain('orderedList');
      
      // Verify social elements are preserved throughout
      const expandStr = JSON.stringify(expandContent);
      const mentionCount = (expandStr.match(/"type":"mention"/g) || []).length;
      const statusCount = (expandStr.match(/"type":"status"/g) || []).length;
      const dateCount = (expandStr.match(/"type":"date"/g) || []).length;
      const emojiCount = (expandStr.match(/"type":"emoji"/g) || []).length;
      
      expect(mentionCount).toBeGreaterThan(5); // Multiple mentions throughout
      expect(statusCount).toBeGreaterThan(2);  // Multiple status elements
      expect(dateCount).toBeGreaterThan(1);    // Multiple dates
      expect(emojiCount).toBeGreaterThan(0);   // At least one emoji
    });
  });

  describe('Panel Block Content', () => {
    it('should parse all block types in panel blocks too', () => {
      const markdown = `~~~panel type=info title="System Information"

# Server Status

Current status: {status:operational}

| Server | Status | Owner |
|--------|--------|-------|
| Web | {status:active} | {user:web.admin} |
| DB | {status:active} | {user:db.admin} |

\`\`\`bash
systemctl status nginx
\`\`\`

> Maintained by {user:ops.team}

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      const panel = adf.content[0];
      expect(panel.type).toBe('panel');
      
      const panelContent = panel.content || [];
      const nodeTypes = panelContent.map((node: any) => node.type);
      
      expect(nodeTypes).toContain('heading');
      expect(nodeTypes).toContain('paragraph');  
      expect(nodeTypes).toContain('table');
      expect(nodeTypes).toContain('codeBlock');
      expect(nodeTypes).toContain('blockquote');
      
      // Verify social elements work in panels too
      const panelStr = JSON.stringify(panelContent);
      expect(panelStr).toContain('"type":"mention"');
      expect(panelStr).toContain('"type":"status"');
    });
  });

  describe('ADF Fence Blocks in Expand Blocks', () => {
    it('should parse nested panel blocks in expand blocks', () => {
      const markdown = `~~~expand title="Documentation"

~~~panel type=info title="Important Information"
This is an info panel with {user:admin} :star:
~~~

Additional content after the panel.

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      
      const expandContent = adf.content[0].content || [];
      const panel = expandContent.find((node: any) => node.type === 'panel');
      
      expect(panel).toBeDefined();
      expect(panel.attrs.panelType).toBe('info');
      expect(panel.attrs.title).toBe('Important Information');
      
      // Check social elements within the panel
      const panelStr = JSON.stringify(panel);
      expect(panelStr).toContain('"type":"mention"');
      expect(panelStr).toContain('"type":"emoji"');
    });

    it('should parse nested mediaSingle blocks in expand blocks', () => {
      const markdown = `~~~expand title="Media Gallery"

~~~mediaSingle layout=center width=80
![Description](media:media-id-123)
~~~

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      
      const expandContent = adf.content[0].content || [];
      const mediaSingle = expandContent.find((node: any) => node.type === 'mediaSingle');
      
      expect(mediaSingle).toBeDefined();
      expect(mediaSingle.attrs.layout).toBe('center');
      expect(mediaSingle.attrs.width).toBe(80);
    });

    it('should parse nested mediaGroup blocks in expand blocks', () => {
      const markdown = `~~~expand title="Image Gallery"

~~~mediaGroup
![Image 1](media:id-1)
![Image 2](media:id-2)
~~~

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      
      const expandContent = adf.content[0].content || [];
      const mediaGroup = expandContent.find((node: any) => node.type === 'mediaGroup');
      
      expect(mediaGroup).toBeDefined();
      expect(mediaGroup.content).toHaveLength(2); // Two media items
    });

    it('should parse multiple nested ADF fence blocks in expand blocks', () => {
      const markdown = `~~~expand title="Complex Nested Content"

~~~panel type=warning title="Warning"
Important notice with {status:active}
~~~

~~~mediaSingle layout=wide
![Diagram](media:diagram-123)
~~~

~~~panel type=success title="Success"
Process completed by {user:system.admin} on {date:2024-01-30}
~~~

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      
      const expandContent = adf.content[0].content || [];
      console.log('🔍 Expand content structure:', JSON.stringify(expandContent, null, 2));
      
      const warningPanel = expandContent.find((node: any) => 
        node.type === 'panel' && node.attrs?.panelType === 'warning'
      );
      const mediaSingle = expandContent.find((node: any) => node.type === 'mediaSingle');
      const successPanel = expandContent.find((node: any) => 
        node.type === 'panel' && node.attrs?.panelType === 'success'
      );
      
      expect(warningPanel).toBeDefined();
      expect(mediaSingle).toBeDefined();
      expect(successPanel).toBeDefined();
      
      // Verify social elements in panels
      const expandStr = JSON.stringify(expandContent);
      expect(expandStr).toContain('"type":"status"');
      expect(expandStr).toContain('"type":"mention"');
      expect(expandStr).toContain('"type":"date"');
    });
  });

  describe('ADF Fence Blocks in Panel Blocks', () => {
    it('should parse nested expand blocks in panel blocks', () => {
      const markdown = `~~~panel type=info title="Container Panel"

~~~expand title="Nested Expandable Section"
This content is nested inside a panel with {user:nested.user}
~~~

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('panel');
      expect(adf.content[0].attrs.panelType).toBe('info');
      
      const panelContent = adf.content[0].content || [];
      const nestedExpand = panelContent.find((node: any) => node.type === 'expand');
      
      expect(nestedExpand).toBeDefined();
      expect(nestedExpand.attrs.title).toBe('Nested Expandable Section');
      
      // Check social elements within the nested expand
      const nestedStr = JSON.stringify(nestedExpand);
      expect(nestedStr).toContain('"type":"mention"');
    });

    it('should parse nested mediaSingle blocks in panel blocks', () => {
      const markdown = `~~~panel type=note title="Technical Documentation"

~~~mediaSingle layout=full-width
![Architecture Diagram](media:arch-diagram)
~~~

This diagram shows the system architecture.

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('panel');
      
      const panelContent = adf.content[0].content || [];
      const mediaSingle = panelContent.find((node: any) => node.type === 'mediaSingle');
      
      expect(mediaSingle).toBeDefined();
      expect(mediaSingle.attrs.layout).toBe('full-width');
      
      // Should also have a paragraph with the description text
      const paragraph = panelContent.find((node: any) => node.type === 'paragraph');
      expect(paragraph).toBeDefined();
    });
  });

  describe('Deep Nesting of ADF Fence Blocks', () => {
    it('should handle expand within panel within expand', () => {
      const markdown = `~~~expand title="Outer Expand"

~~~panel type=info title="Middle Panel"

~~~expand title="Inner Expand"
Deeply nested content with {user:deep.user} and {status:nested}
~~~

~~~

~~~`;
      
      const tokens = tokenizer.tokenize(markdown);
      const adf = builder.buildADF(tokens);

      expect(adf.content[0].type).toBe('expand');
      expect(adf.content[0].attrs.title).toBe('Outer Expand');
      
      // Find the nested panel
      const outerContent = adf.content[0].content || [];
      const middlePanel = outerContent.find((node: any) => node.type === 'panel');
      expect(middlePanel).toBeDefined();
      
      // Find the inner expand within the panel
      const panelContent = middlePanel.content || [];
      const innerExpand = panelContent.find((node: any) => node.type === 'expand');
      expect(innerExpand).toBeDefined();
      expect(innerExpand.attrs.title).toBe('Inner Expand');
      
      // Check social elements in the deepest level
      const innerStr = JSON.stringify(innerExpand);
      expect(innerStr).toContain('"type":"mention"');
      expect(innerStr).toContain('"type":"status"');
    });
  });
});