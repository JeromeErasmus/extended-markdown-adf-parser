# Extended ADF Markdown Parser

> **📖 Official ADF Documentation**: [Atlassian Document Format Structure](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)

[![npm version](https://badge.fury.io/js/extended-markdown-adf-parser.svg)](https://badge.fury.io/js/extended-markdown-adf-parser)
[![npm downloads](https://img.shields.io/npm/dm/extended-markdown-adf-parser.svg)](https://npmjs.org/package/extended-markdown-adf-parser)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/extended-markdown-adf-parser)](https://bundlephobia.com/package/extended-markdown-adf-parser)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/npm/l/extended-markdown-adf-parser.svg)](https://github.com/JeromeErasmus/extended-markdown-adf-parser/blob/main/LICENSE)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/JeromeErasmus/extended-markdown-adf-parser)

A bidirectional parser for converting between [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) and Extended Markdown.

**[Complete Documentation](https://jeromeerasmus.gitbook.io/extended-markdown-adf-parser)** - Full guide with examples, API reference, and advanced usage patterns.

**What is ADF?** Atlassian Document Format (ADF) is a JSON-based document format used by Atlassian products like Jira and Confluence to represent rich content including text formatting, tables, panels, media, and other structured elements.

## Features

- **Bidirectional Conversion**: Convert ADF to Extended Markdown and back  
  Seamlessly transform content between Atlassian Document Format and Extended Markdown with complete round-trip fidelity.

- **Extended Markdown Syntax**: Support for ADF-specific elements like `panels`, `expands`, and `media`  
  Beyond standard Markdown, includes ADF extensions such as `info panels`, `expandable sections`, and `media placeholders` with full nested structure support.

- **Advanced Nested Processing** ✨ _New in v2.2.0_: Multi-pass parsing for complex nested ADF structures  
  Comprehensive nested ADF fence block processing enables complex document hierarchies with panels containing media, expandable sections with sub-panels, and unlimited nesting depth.

- **Full Fidelity**: Preserves all ADF attributes through metadata annotations  
  Custom attributes and styling information are maintained using HTML comment metadata, ensuring no data loss during conversion.

- **Universal Module Support**: True dual package with zero configuration  
  Supports CommonJS `require()`, ESM `import`, and dynamic `import()` with automatic format selection, bundled dependencies, and complete TypeScript compatibility.

- **Type Safe**: Written in TypeScript with complete type definitions  
  Full TypeScript support with comprehensive type definitions for all ADF nodes, ensuring compile-time safety and excellent IDE support.

- **Comprehensive Test Coverage**: 100% test coverage with 399 tests across 29 test suites  
  Thoroughly tested with integration tests, unit tests, and fixture validation covering all ADF node types and conversion scenarios.

- **Zero Runtime Dependencies**: Lightweight and portable (uses well-established libraries)  
  Built on proven libraries like `unified/remark` ecosystem, with no additional runtime dependencies for your applications.

## Supported Elements

This parser provides bidirectional conversion support between Markdown and ADF. The table below shows all supported elements and their conversion capabilities:

| Element Type | ADF Node | Description | Markdown → ADF | ADF → Markdown |
|--------------|----------|-------------|:--------------:|:--------------:|
| **DOCUMENT STRUCTURE** |
| Document | `doc` | Root document container | ✓ | ✓ |
| Paragraph | `paragraph` | Text paragraphs with attributes | ✓ | ✓ |
| Hard Break | `hardBreak` | Explicit line breaks | ✓ | ✓ |
| Text | `text` | Raw text content | ✓ | ✓ |
| **HEADINGS** |
| Heading L1 | `heading` | Level 1 heading | ✓ | ✓ |
| Heading L2 | `heading` | Level 2 heading | ✓ | ✓ |
| Heading L3 | `heading` | Level 3 heading | ✓ | ✓ |
| Heading L4 | `heading` | Level 4 heading | ✓ | ✓ |
| Heading L5 | `heading` | Level 5 heading | ✓ | ✓ |
| Heading L6 | `heading` | Level 6 heading | ✓ | ✓ |
| **TEXT FORMATTING** |
| Bold | `mark:strong` | Bold text formatting | ✓ | ✓ |
| Italic | `mark:em` | Italic text formatting | ✓ | ✓ |
| Inline Code | `mark:code` | Inline code spans | ✓ | ✓ |
| Strikethrough | `mark:strike` | Crossed out text | ✓ | ✓ |
| Underline | `mark:underline` | Underlined text | ✓ | ✓ |
| Text Color | `mark:textColor` | Custom text colors | ✓ | ✓ |
| Background Color | `mark:backgroundColor` | Text background colors | ✓ | ✓ |
| Link | `mark:link` | Hyperlinks with titles | ✓ | ✓ |
| Subscript/Superscript | `mark:subsup` | Sub/superscript text | ✓ | ✓ |
| **LISTS** |
| Bullet List | `bulletList` | Unordered lists | ✓ | ✓ |
| Ordered List | `orderedList` | Numbered lists | ✓ | ✓ |
| List Item | `listItem` | Individual list items | ✓ | ✓ |
| **TABLES** |
| Table | `table` | Complete table structures | ✓ | ✓ |
| Table Row | `tableRow` | Individual table rows | ✓ | ✓ |
| Table Header | `tableHeader` | Table header cells | ✓ | ✓ |
| Table Cell | `tableCell` | Regular table cells | ✓ | ✓ |
| **QUOTES & CODE** |
| Blockquote | `blockquote` | Quote blocks with nesting | ✓ | ✓ |
| Code Block | `codeBlock` | Fenced code blocks | ✓ | ✓ |
| Horizontal Rule | `rule` | Document dividers | ✓ | ✓ |
| **ADF PANELS** |
| Info Panel | `panel` | Information panels | ✓ | ✓ |
| Warning Panel | `panel` | Warning panels | ✓ | ✓ |
| Error Panel | `panel` | Error panels | ✓ | ✓ |
| Success Panel | `panel` | Success panels | ✓ | ✓ |
| Note Panel | `panel` | Note panels | ✓ | ✓ |
| **MEDIA ELEMENTS** |
| Media | `media` | Individual media items | ✓ | ✓ |
| Media Single | `mediaSingle` | Single media with layout | ✓ | ✓ |
| Media Group | `mediaGroup` | Multiple media grouped | ✓ | ✓ |
| **INTERACTIVE ELEMENTS** |
| Expand | `expand` | Collapsible content sections | ✓ | ✓ |
| Inline Card | `inlineCard` | Embedded link previews | ✓ | ✓ |
| **SOCIAL ELEMENTS** |
| Mention | `mention` | User mentions | ✓ | ✓ |
| Emoji | `emoji` | Emoji characters | ✓ | ✓ |
| Date | `date` | Date stamps | ✓ | ✓ |
| Status | `status` | Status indicators | ✓ | ✓ |

## Installation

```bash
npm install extended-markdown-adf-parser
# or
yarn add extended-markdown-adf-parser
```

## Module Support

This package provides **full dual package support** for both **CommonJS** and **ES Modules (ESM)** with automatic format detection and zero configuration required.

### ✅ CommonJS Support
Works in Node.js projects, TypeScript projects compiling to CommonJS, and any environment expecting CommonJS modules:
```javascript
const { Parser } = require('extended-markdown-adf-parser');

const parser = new Parser();
const adf = parser.markdownToAdf('# Hello World');
```

### ✅ ES Modules (ESM) Support
Works in modern Node.js projects, browsers, and TypeScript projects using ES modules:
```javascript
import { Parser } from 'extended-markdown-adf-parser';

const parser = new Parser();
const adf = parser.markdownToAdf('# Hello World');
```

### ✅ Dynamic Import (Universal)
Works in both CommonJS and ESM environments:
```javascript
const { Parser } = await import('extended-markdown-adf-parser');

const parser = new Parser();
const adf = parser.markdownToAdf('# Hello World');
```

### ✅ TypeScript Support
Full type definitions for all module systems:
```typescript
import { Parser, type ADFDocument, type ConversionOptions } from 'extended-markdown-adf-parser';
// or
const { Parser } = require('extended-markdown-adf-parser');
```

### Module Resolution Details
- **Package Type**: Dual package with proper `exports` configuration
- **CommonJS Output**: Bundled `.cjs` files with all dependencies included
- **ESM Output**: Tree-shakable `.mjs` files with external dependencies
- **Automatic Selection**: Node.js automatically selects the correct format
- **Zero Configuration**: No build tools or configuration changes required

## Usage

### Simple Example

```typescript
// Choose your preferred import method - both work identically
import { Parser } from 'extended-markdown-adf-parser';           // ESM
// const { Parser } = require('extended-markdown-adf-parser');  // CommonJS

const parser = new Parser();

// Convert ADF to Extended Markdown
const adf = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello World' }
      ]
    }
  ]
};

const markdown = parser.adfToMarkdown(adf);
console.log(markdown); // "Hello World"

// Convert Extended Markdown back to ADF
const reconstructed = parser.markdownToAdf(markdown);
console.log(reconstructed); // Original ADF structure
```

### Complex Example with ADF Extensions

```typescript
// Works with both CommonJS and ESM
import { Parser } from 'extended-markdown-adf-parser';
// const { Parser } = require('extended-markdown-adf-parser');

// ADF extensions are enabled by default in the unified architecture
const parser = new Parser();

// Extended Markdown with metadata and ADF elements
const extendedMarkdown = `---
title: "Complete Document Example"
author: "Extended ADF Parser"
---

<!-- adf:heading id="main-title" textAlign="center" -->
# Main Document Title

<!-- adf:paragraph textAlign="justify" lineHeight="1.6" -->
This is a justified paragraph with custom line spacing that demonstrates the full capabilities of the Extended ADF Markdown Parser.

<!-- adf:panel backgroundColor="#e6f7ff" borderColor="#1890ff" -->
~~~panel type=info title="Important Information"
This panel contains important information with custom styling.

<!-- adf:bulletList bulletStyle="square" -->
- Custom styled bullet list
- With square bullets
- Inside the panel
~~~

## Standard Markdown Section

This section uses standard Markdown without ADF extensions:

- **Bold text**
- *Italic text*  
- \`Inline code\`
- ~~Strikethrough~~

\`\`\`javascript
// Code block with syntax highlighting
function example() {
    return "Hello, World!";
}
\`\`\`

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

<!-- adf:expand defaultOpen="true" -->
~~~expand title="Additional Resources"
This expandable section contains additional resources and links for further reading.

[External Documentation](https://example.com)
~~~`;

// Convert to ADF
const adf = parser.markdownToAdf(extendedMarkdown);

// Convert back to markdown
const reconstructedMarkdown = parser.adfToMarkdown(adf);

console.log('ADF Document:', JSON.stringify(adf, null, 2));
console.log('Reconstructed Markdown:', reconstructedMarkdown);
```



### Extended Markdown Syntax

#### Metadata Comments
Apply custom attributes to any element:
```markdown
<!-- adf:paragraph textAlign="center" -->
This paragraph is centered.

<!-- adf:heading id="custom-id" anchor="custom-anchor" -->
# Custom Heading
```

#### ADF Fence Blocks
```markdown
~~~panel type=info title="Information"
Content with **formatting** inside panels.
~~~

~~~expand title="Click to expand" expanded=true
Collapsible content that starts expanded.
~~~

~~~mediaSingle layout=center width=80
![Description](media:media-id-here)
~~~

~~~mediaGroup
![Image 1](media:id-1)
![Image 2](media:id-2)
~~~
```

#### Nested ADF Fence Blocks ✨ _New in v2.2.0_
ADF fence blocks can now be nested within each other, enabling complex document structures:

```markdown
~~~expand title="Project Overview"

~~~panel type=warning title="Important Notice"
Please review the requirements before proceeding.
~~~

~~~mediaSingle layout=wide
![Architecture Diagram](media:diagram-123)
~~~

~~~panel type=success title="Status"
All tests passing ✅
~~~

~~~
```

**Supported nested patterns:**
- `~~~expand` containing panels, media, and other expandable sections
- `~~~panel` with nested media blocks and sub-panels  
- Complex multi-level nesting with full content parsing
- All ADF fence types: `panel`, `expand`, `nestedExpand`, `mediaSingle`, `mediaGroup`

#### Media References
```markdown
# Media placeholders
![Alt text](media:media-id-123)

# User mentions  
{user:username}
{user:user-id-123}

# Media references
{media:media-id-456}
```

#### Frontmatter Support
```yaml
---
title: "Document Title"
author: "Author Name"
tags: [tag1, tag2, tag3]
metadata:
  custom: "value"
---
```

## Architecture

### Unified Parser Architecture (v2.1.6+)

The library has been completely refactored with a **unified architecture** that eliminates duplication and ensures consistent, high-quality conversions across all parser interfaces:

#### Core Components

1. **Unified Parser Class** - The main `Parser` class now uses shared conversion engines internally
2. **MarkdownToAdfEngine** - Dedicated engine for markdown → ADF conversion
3. **AdfToMarkdownEngine** - Dedicated engine for ADF → markdown conversion
4. **Backward Compatibility** - `EnhancedMarkdownParser` now simply extends `Parser`

#### Key Improvements

- **🎯 Consistent Results**: All parsing approaches now produce identical, high-quality results
- **✨ No Configuration Required**: ADF extensions are enabled by default (no more `enableAdfExtensions` flag)
- **🔧 Social Elements**: Proper parsing of `{user:mention}`, `:emoji:`, `{status:text}`, and `{date:YYYY-MM-DD}` in all contexts
- **⚡ Performance**: Shared engines eliminate code duplication and improve maintainability
- **🛡️ Error Recovery**: Built-in error recovery with configurable retry strategies

#### Usage Patterns

All these approaches now produce **identical results**:

```typescript
import { Parser, EnhancedMarkdownParser, MarkdownToAdfEngine } from 'extended-markdown-adf-parser';

// 1. Main Parser class (recommended)
const parser = new Parser();
const adf = parser.markdownToAdf(markdown);

// 2. Enhanced parser (backward compatibility)
const enhanced = new EnhancedMarkdownParser();
const adf2 = enhanced.parseSync(markdown);

// 3. Direct engine usage (for custom implementations)
const engine = new MarkdownToAdfEngine();
const adf3 = engine.convert(markdown);

// All produce identical results: adf === adf2 === adf3
```

#### Migration Guide

**Before (v2.1.5 and earlier):**
```typescript
const parser = new Parser({ enableAdfExtensions: true });
const enhanced = new EnhancedMarkdownParser();
```

**After (v2.1.6+):**
```typescript
// Simply use Parser - ADF extensions enabled by default
const parser = new Parser();

// EnhancedMarkdownParser still works (backward compatibility)
const enhanced = new EnhancedMarkdownParser();
```

## Testing

This library includes a comprehensive test suite with 399 tests across 29 test suites, ensuring reliability and correctness across all supported features.

### Test Categories

**Integration Tests** - End-to-end conversion and validation
- Markdown to ADF conversion with all supported elements
- Bidirectional round-trip conversion fidelity
- Enhanced parser with metadata comments support
- Media placeholders and ADF URL resolution
- Whitespace resilience and error handling
- Performance validation (avg <2ms per conversion)

**Unit Tests** - Individual component testing  
- Parser classes (unified `Parser`, `MarkdownToAdfEngine`, `AdfToMarkdownEngine`)
- Node converters (panels, tables, media, lists, etc.)
- Mark converters (formatting, links, colors, etc.)
- Core components (converter registry, validators)
- Remark plugins and micromark extensions

**Fixture Validation** - Comprehensive markup coverage
- 17 markdown fixture files covering all ADF elements
- 11 corresponding ADF fixtures for validation
- 30+ ADF node types with complete attribute support
- Complex nested structures and edge cases
- Malformed input handling and recovery

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testNamePattern="Integration"
npm test -- --testNamePattern="Unit"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT