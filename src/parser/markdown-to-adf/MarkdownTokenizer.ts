/**
 * @file MarkdownTokenizer.ts
 * @description Tokenizes Extended Markdown into structured tokens for ADF conversion
 * @author Extended ADF Parser
 */

import { Token, TokenType, Position, ParsingContext, TokenizeOptions, ListToken, ListItemToken, TableToken, FenceToken, ADFMetadata } from './types.js';

export class MarkdownTokenizer {
  private lines: string[] = [];
  private currentLineIndex: number = 0;
  private context: ParsingContext;
  private options: TokenizeOptions;
  private depth: number;

  constructor(options: TokenizeOptions = {}, depth: number = 0) {
    this.options = {
      preserveWhitespace: false,
      strict: false,
      maxDepth: 5, // Further reduced to prevent memory issues
      ...options
    };
    this.depth = depth;
    
    this.context = this.createInitialContext();
  }

  /**
   * Tokenize markdown string into structured tokens
   */
  tokenize(markdown: string): Token[] {
    // Prevent processing excessively large inputs that could cause memory issues
    if (markdown.length > 1000000) {
      throw new Error('Input too large for tokenization');
    }
    
    this.lines = markdown.split(/\r?\n/);
    this.currentLineIndex = 0;
    this.context = this.createInitialContext();

    const tokens: Token[] = [];
    
    // Handle YAML frontmatter first
    const frontmatterToken = this.parseFrontmatter();
    if (frontmatterToken) {
      tokens.push(frontmatterToken);
    }

    // Process remaining content with safety limits
    let iterationCount = 0;
    const maxIterations = 10000; // Prevent infinite loops
    
    while (this.currentLineIndex < this.lines.length && iterationCount < maxIterations) {
      iterationCount++;
      const token = this.parseNextToken();
      if (token) {
        tokens.push(token);
      }
      
      // Safety check for excessive token count
      if (tokens.length > 10000) {
        console.warn('Token limit reached, stopping tokenization');
        break;
      }
    }

    return tokens;
  }

  private createInitialContext(): ParsingContext {
    return {
      inList: false,
      inTable: false,
      inBlockquote: false,
      inFenceBlock: false,
      listDepth: 0,
      currentLine: 1,
      currentColumn: 1,
      currentOffset: 0
    };
  }

  private getCurrentPosition(): Position {
    const line = this.lines[this.currentLineIndex] || '';
    return {
      line: this.currentLineIndex + 1,
      column: 1,
      offset: this.lines.slice(0, this.currentLineIndex).join('\n').length
    };
  }

  private getCurrentLine(): string {
    return this.lines[this.currentLineIndex] || '';
  }

  private peekLine(offset: number = 1): string {
    return this.lines[this.currentLineIndex + offset] || '';
  }

  private consumeLine(): string {
    const line = this.getCurrentLine();
    this.currentLineIndex++;
    return line;
  }

  private parseFrontmatter(): Token | null {
    if (!this.getCurrentLine().startsWith('---')) {
      return null;
    }

    // Check if there's a closing --- (look ahead for YAML frontmatter)
    let hasClosing = false;
    for (let i = this.currentLineIndex + 1; i < this.lines.length; i++) {
      if (this.lines[i].trim() === '---') {
        hasClosing = true;
        break;
      }
      // Stop looking if we hit content that's not YAML-like
      if (i > this.currentLineIndex + 20) break; // Don't scan too far
    }

    if (!hasClosing) {
      return null; // Not frontmatter, just a regular --- rule
    }

    const startPos = this.getCurrentPosition();
    const lines: string[] = [];
    
    // Skip opening ---
    this.consumeLine();

    // Collect frontmatter content
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();
      if (line.trim() === '---') {
        this.consumeLine(); // Skip closing ---
        break;
      }
      lines.push(line);
      this.consumeLine();
    }

    return {
      type: 'frontmatter',
      content: lines.join('\n'),
      position: startPos,
      raw: `---\n${lines.join('\n')}\n---`
    };
  }

  private parseNextToken(): Token | null {
    const line = this.getCurrentLine();
    
    // Skip empty lines (unless we're preserving whitespace)
    if (!line.trim() && !this.options.preserveWhitespace) {
      this.consumeLine();
      return null;
    }

    // Check for different token types in order of precedence
    
    // ADF Fence blocks (~~~)
    if (this.isADFFenceBlock(line)) {
      return this.parseADFFenceBlock();
    }

    // Code blocks (```)
    if (this.isCodeFenceBlock(line)) {
      return this.parseCodeBlock();
    }

    // Headings
    if (this.isHeading(line)) {
      return this.parseHeading();
    }

    // Tables
    if (this.isTableStart()) {
      return this.parseTable();
    }

    // Lists
    if (this.isList(line)) {
      return this.parseList();
    }

    // Blockquotes
    if (this.isBlockquote(line)) {
      return this.parseBlockquote();
    }

    // Horizontal rule
    if (this.isRule(line)) {
      return this.parseRule();
    }

    // Default to paragraph
    return this.parseParagraph();
  }

  private isADFFenceBlock(line: string): boolean {
    return /^~~~(\w+)(?:\s+.*)?$/.test(line.trim());
  }

  private isCodeFenceBlock(line: string): boolean {
    return /^```/.test(line.trim());
  }

  private isHeading(line: string): boolean {
    return /^#{1,6}\s/.test(line.trim());
  }

  private isTableStart(): boolean {
    const currentLine = this.getCurrentLine();
    const nextLine = this.peekLine();
    
    // Check if current line looks like table header and next line is separator
    const hasTableRow = /\|.*\|/.test(currentLine);
    const hasTableSeparator = /^\s*\|?\s*:?-+:?\s*\|/.test(nextLine);
    
    return hasTableRow && hasTableSeparator;
  }

  private isList(line: string): boolean {
    const trimmed = line.trim();
    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) return true;
    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) return true;
    return false;
  }

  private isBlockquote(line: string): boolean {
    return /^\s*>\s?/.test(line);
  }

  private isRule(line: string): boolean {
    const trimmed = line.trim();
    return /^(---+|\*\*\*+|___+)$/.test(trimmed);
  }

  private parseADFFenceBlock(): FenceToken {
    const startPos = this.getCurrentPosition();
    const openingLine = this.consumeLine();
    
    // Parse fence attributes: ~~~panel type=info layout=wide
    const match = openingLine.match(/^~~~(\w+)(?:\s+(.*))?$/);
    const nodeType = match?.[1] || 'unknown';
    const attributesStr = match?.[2] || '';
    
    const attributes = this.parseFenceAttributes(attributesStr);
    const contentLines: string[] = [];
    let raw = openingLine + '\n';

    // Collect content until closing fence
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();
      if (line.trim() === '~~~') {
        raw += this.consumeLine() + '\n';
        break;
      }
      contentLines.push(line);
      raw += this.consumeLine() + '\n';
    }

    // Parse content as markdown tokens (with depth check)
    let children: Token[] = [];
    if (this.depth < this.options.maxDepth! && contentLines.join('\n').trim()) {
      const contentTokenizer = new MarkdownTokenizer(this.options, this.depth + 1);
      children = contentTokenizer.tokenize(contentLines.join('\n'));
    }

    return {
      type: nodeType as any,
      fenceType: 'tilde',
      content: contentLines.join('\n'),
      attributes,
      children,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseCodeBlock(): Token {
    const startPos = this.getCurrentPosition();
    const openingLine = this.consumeLine();
    
    // Extract language: ```javascript
    const language = openingLine.replace(/^```/, '').trim();
    const contentLines: string[] = [];
    let raw = openingLine + '\n';

    // Collect content until closing fence
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();
      if (line.trim().startsWith('```')) {
        raw += this.consumeLine() + '\n';
        break;
      }
      contentLines.push(line);
      raw += this.consumeLine() + '\n';
    }

    return {
      type: 'codeBlock',
      content: contentLines.join('\n'),
      metadata: language ? { 
        nodeType: 'codeBlock', 
        attrs: { language } 
      } : undefined,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseHeading(): Token {
    const startPos = this.getCurrentPosition();
    const line = this.consumeLine();
    
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      // Fallback - treat as paragraph
      return {
        type: 'paragraph',
        content: line,
        position: startPos,
        raw: line
      };
    }

    const level = match[1].length;
    let content = match[2];
    let metadata: ADFMetadata | undefined;

    // Check for inline metadata comment
    const metadataMatch = content.match(/^(.*?)\s*<!-- adf:heading attrs='(.*)' -->$/);
    if (metadataMatch) {
      content = metadataMatch[1].trim();
      try {
        const attrs = JSON.parse(metadataMatch[2].replace(/'/g, '"'));
        metadata = { nodeType: 'heading', attrs: { level, ...attrs } };
      } catch {
        // Invalid metadata, use default
        metadata = { nodeType: 'heading', attrs: { level } };
      }
    } else {
      metadata = { nodeType: 'heading', attrs: { level } };
    }

    return {
      type: 'heading',
      content,
      metadata,
      position: startPos,
      raw: line
    };
  }

  private parseTable(): TableToken {
    const startPos = this.getCurrentPosition();
    const rows: Token[] = [];
    let raw = '';

    // Parse header row
    const headerLine = this.consumeLine();
    raw += headerLine + '\n';
    const headerToken = this.parseTableRow(headerLine, 'tableHeader');
    rows.push(headerToken);

    // Parse separator row to determine column alignments
    const separatorLine = this.consumeLine();
    raw += separatorLine + '\n';
    const alignments = this.parseTableAlignments(separatorLine);

    // Parse data rows
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();
      if (!line.trim() || !line.includes('|')) {
        break;
      }
      raw += this.consumeLine() + '\n';
      const rowToken = this.parseTableRow(line, 'tableCell');
      rows.push(rowToken);
    }

    return {
      type: 'table',
      content: '',
      columnAlignments: alignments,
      children: rows,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseTableRow(line: string, cellType: 'tableHeader' | 'tableCell'): Token {
    const cells: Token[] = [];
    
    // Split by | but handle escaped pipes
    const parts = line.split(/(?<!\\)\|/);
    
    // Remove first and last if empty (table borders)
    if (parts.length > 0 && !parts[0].trim()) parts.shift();
    if (parts.length > 0 && !parts[parts.length - 1].trim()) parts.pop();

    for (const part of parts) {
      const cellContent = part.trim().replace(/\\\|/g, '|'); // Unescape pipes
      let content = cellContent;
      let metadata: ADFMetadata | undefined;

      // Check for cell metadata: Cell content <!-- adf:cell colspan="2" -->
      const metadataMatch = content.match(/^(.*?)\s*<!-- adf:cell (.*?) -->$/);
      if (metadataMatch) {
        content = metadataMatch[1].trim();
        const attrsStr = metadataMatch[2];
        try {
          const attrs: Record<string, any> = {};
          // Parse key="value" pairs
          const attrMatches = attrsStr.match(/(\w+)="([^"]*)"/g);
          attrMatches?.forEach(match => {
            const [, key, value] = match.match(/(\w+)="([^"]*)"/) || [];
            if (key && value) {
              attrs[key] = isNaN(Number(value)) ? value : Number(value);
            }
          });
          metadata = { nodeType: cellType, attrs };
        } catch {
          // Invalid metadata, ignore
        }
      }

      cells.push({
        type: cellType,
        content,
        metadata,
        position: this.getCurrentPosition(),
        raw: cellContent
      });
    }

    return {
      type: 'tableRow',
      content: '',
      children: cells,
      position: this.getCurrentPosition(),
      raw: line
    };
  }

  private parseTableAlignments(separatorLine: string): ('left' | 'center' | 'right' | null)[] {
    const parts = separatorLine.split('|').filter(p => p.trim());
    return parts.map(part => {
      const trimmed = part.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      if (trimmed.startsWith(':')) return 'left';
      return null;
    });
  }

  private parseList(): ListToken {
    const startPos = this.getCurrentPosition();
    const items: Token[] = [];
    let raw = '';
    
    const firstLine = this.getCurrentLine();
    const isOrdered = /^\s*\d+\./.test(firstLine);
    const startMatch = isOrdered ? firstLine.match(/^\s*(\d+)\./) : null;
    const start = startMatch ? parseInt(startMatch[1]) : undefined;

    // Parse list items
    while (this.currentLineIndex < this.lines.length && this.isListItemContinuation()) {
      const itemToken = this.parseListItem();
      if (itemToken) {
        items.push(itemToken);
        raw += itemToken.raw + '\n';
      }
    }

    return {
      type: 'list',
      ordered: isOrdered,
      start,
      tight: this.isListTight(items),
      content: '',
      children: items,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseListItem(): Token {
    const startPos = this.getCurrentPosition();
    const lines: string[] = [];
    let raw = '';

    // Get first line and extract content
    const firstLine = this.consumeLine();
    raw += firstLine + '\n';

    const match = firstLine.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
    let content = match?.[1] || firstLine;

    // Detect checkbox syntax: [x], [X], or [ ]
    let checked: boolean | undefined;
    const checkboxMatch = content.match(/^\[(x|X| )\]\s/);
    if (checkboxMatch) {
      checked = checkboxMatch[1] === 'x' || checkboxMatch[1] === 'X';
      content = content.slice(checkboxMatch[0].length);
    }

    lines.push(content);

    // Collect continuation lines
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();

      // Stop if we hit another list item at same or lower level
      if (this.isList(line)) break;

      // Stop if we hit a completely unindented line
      if (line.trim() && !line.startsWith('  ')) break;

      // Include indented continuation
      if (line.startsWith('  ') || !line.trim()) {
        lines.push(line.slice(2)); // Remove 2-space indent
        raw += this.consumeLine() + '\n';
      } else {
        break;
      }
    }

    // Parse item content as tokens (with depth check)
    let children: Token[] = [];
    if (this.depth < this.options.maxDepth! && lines.join('\n').trim()) {
      const itemTokenizer = new MarkdownTokenizer(this.options, this.depth + 1);
      children = itemTokenizer.tokenize(lines.join('\n'));
    }

    return {
      type: 'listItem',
      content: lines.join('\n'),
      children,
      position: startPos,
      raw: raw.trimEnd(),
      ...(checked !== undefined && { checked })
    } as ListItemToken;
  }

  private parseBlockquote(): Token {
    const startPos = this.getCurrentPosition();
    const lines: string[] = [];
    let raw = '';

    // Collect blockquote lines
    while (this.currentLineIndex < this.lines.length && this.isBlockquote(this.getCurrentLine())) {
      const line = this.consumeLine();
      raw += line + '\n';
      // Remove > prefix and optional space
      const content = line.replace(/^\s*>\s?/, '');
      lines.push(content);
    }

    // Parse blockquote content as tokens (with depth check)
    let children: Token[] = [];
    if (this.depth < this.options.maxDepth! && lines.join('\n').trim()) {
      const quoteTokenizer = new MarkdownTokenizer(this.options, this.depth + 1);
      children = quoteTokenizer.tokenize(lines.join('\n'));
    }

    return {
      type: 'blockquote',
      content: lines.join('\n'),
      children,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseRule(): Token {
    const startPos = this.getCurrentPosition();
    const line = this.consumeLine();
    
    return {
      type: 'rule',
      content: '',
      position: startPos,
      raw: line
    };
  }

  private parseParagraph(): Token {
    const startPos = this.getCurrentPosition();
    const lines: string[] = [];
    let raw = '';

    // Collect paragraph lines until we hit a block boundary
    while (this.currentLineIndex < this.lines.length) {
      const line = this.getCurrentLine();
      
      // Stop on empty line
      if (!line.trim()) break;
      
      // Stop on block-level elements
      if (this.isHeading(line) || this.isList(line) || this.isBlockquote(line) ||
          this.isRule(line) || this.isADFFenceBlock(line) || this.isCodeFenceBlock(line)) {
        break;
      }
      
      lines.push(line);
      raw += this.consumeLine() + '\n';
    }

    const content = lines.join('\n');
    const inlineTokens = this.parseInlineContent(content);
    
    return {
      type: 'paragraph',
      content: content,
      children: inlineTokens.length > 0 ? inlineTokens : undefined,
      position: startPos,
      raw: raw.trimEnd()
    };
  }

  private parseInlineContent(text: string): Token[] {
    const tokens: Token[] = [];
    
    // Use a more sophisticated parser that can handle nested formatting
    const parsed = this.parseInlineRecursive(text);
    return parsed;
  }
  
  private parseInlineRecursive(text: string): Token[] {
    if (!text) return [];
    
    const tokens: Token[] = [];
    let position = 0;
    
    // Look for formatting patterns in order of precedence
    const patterns = [
      { type: 'inlineCode' as TokenType, start: '`', end: '`' },
      { type: 'strong' as TokenType, start: '**', end: '**' },
      { type: 'underline' as TokenType, start: '__', end: '__' },
      { type: 'emphasis' as TokenType, start: '*', end: '*' },
      { type: 'strikethrough' as TokenType, start: '~~', end: '~~' }
    ];
    
    // First, handle links which have a more complex pattern
    const linkMatches = this.findLinkMatches(text);
    if (linkMatches.length > 0) {
      return this.parseTextWithLinks(text, linkMatches);
    }
    
    while (position < text.length) {
      // Find the earliest match among all patterns
      let earliestMatch: {
        pattern: typeof patterns[0];
        startIndex: number;
        endIndex: number;
        content: string;
        fullMatch: string;
      } | null = null;
      
      for (const pattern of patterns) {
        const startIndex = text.indexOf(pattern.start, position);
        if (startIndex === -1) continue;
        
        const endIndex = text.indexOf(pattern.end, startIndex + pattern.start.length);
        if (endIndex === -1) continue;
        
        const content = text.slice(startIndex + pattern.start.length, endIndex);
        
        // Skip empty matches (this prevents ** from being split into two * matches)
        if (content === '' && pattern.start === pattern.end) {
          continue;
        }
        
        // Choose the match that starts earliest (or if same start, shortest match)
        if (!earliestMatch || startIndex < earliestMatch.startIndex || 
            (startIndex === earliestMatch.startIndex && endIndex < earliestMatch.endIndex)) {
          earliestMatch = {
            pattern,
            startIndex,
            endIndex,
            content,
            fullMatch: text.slice(startIndex, endIndex + pattern.end.length)
          };
          
        }
      }
      
      if (!earliestMatch) {
        // No more formatting found, add remaining text
        const remainingText = text.slice(position);
        if (remainingText) {
          tokens.push({
            type: 'text',
            content: remainingText,
            position: this.getCurrentPosition(),
            raw: remainingText
          });
        }
        break;
      }
      
      // Add text before the match
      if (earliestMatch.startIndex > position) {
        const plainText = text.slice(position, earliestMatch.startIndex);
        tokens.push({
          type: 'text',
          content: plainText,
          position: this.getCurrentPosition(),
          raw: plainText
        });
      }
      
      // For inline code, don't parse content recursively
      if (earliestMatch.pattern.type === 'inlineCode') {
        tokens.push({
          type: earliestMatch.pattern.type,
          content: earliestMatch.content,
          position: this.getCurrentPosition(),
          raw: earliestMatch.fullMatch
        });
      } else {
        // For other formatting, check if content has nested formatting
        const nestedTokens = this.parseInlineRecursive(earliestMatch.content);
        if (nestedTokens.length === 1 && nestedTokens[0].type === 'text') {
          // Simple case - no nested formatting
          tokens.push({
            type: earliestMatch.pattern.type,
            content: earliestMatch.content,
            position: this.getCurrentPosition(),
            raw: earliestMatch.fullMatch
          });
        } else {
          // Nested formatting - create a token with children or merge marks
          tokens.push({
            type: earliestMatch.pattern.type,
            content: earliestMatch.content,
            children: nestedTokens,
            position: this.getCurrentPosition(),
            raw: earliestMatch.fullMatch
          });
        }
      }
      
      position = earliestMatch.endIndex + earliestMatch.pattern.end.length;
    }
    
    return tokens;
  }
  
  private findLinkMatches(text: string): Array<{
    start: number;
    end: number;
    linkText: string;
    href: string;
    title?: string;
  }> {
    const matches: Array<{
      start: number;
      end: number;
      linkText: string;
      href: string;
      title?: string;
    }> = [];
    
    // Regular markdown links: [text](url) or [text](url "title")
    const linkRegex = /\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const [fullMatch, linkText, href, title] = match;
      matches.push({
        start: match.index,
        end: match.index + fullMatch.length,
        linkText,
        href,
        title
      });
    }
    
    return matches;
  }
  
  private parseTextWithLinks(text: string, linkMatches: Array<{
    start: number;
    end: number;
    linkText: string;
    href: string;
    title?: string;
  }>): Token[] {
    const tokens: Token[] = [];
    let position = 0;
    
    for (const link of linkMatches) {
      // Add text before the link
      if (link.start > position) {
        const beforeText = text.slice(position, link.start);
        const beforeTokens = this.parseInlineRecursive(beforeText);
        tokens.push(...beforeTokens);
      }
      
      // Add the link token
      const linkToken: Token = {
        type: 'link',
        content: link.linkText,
        position: this.getCurrentPosition(),
        raw: text.slice(link.start, link.end),
        metadata: {
          nodeType: 'link',
          attrs: {
            href: link.href,
            ...(link.title && { title: link.title })
          }
        }
      };
      
      // Parse the link text for nested formatting
      if (link.linkText) {
        const linkTextTokens = this.parseInlineRecursive(link.linkText);
        if (linkTextTokens.length > 0) {
          linkToken.children = linkTextTokens;
        }
      }
      
      tokens.push(linkToken);
      position = link.end;
    }
    
    // Add remaining text
    if (position < text.length) {
      const remainingText = text.slice(position);
      const remainingTokens = this.parseInlineRecursive(remainingText);
      tokens.push(...remainingTokens);
    }
    
    return tokens;
  }

  // Helper methods

  private isListItemContinuation(): boolean {
    const line = this.getCurrentLine();
    return this.isList(line) || (line.trim().length > 0 && line.startsWith('  '));
  }

  private isListTight(items: Token[]): boolean {
    // A list is tight if items don't have blank lines between them
    // This is a simplified check - could be enhanced
    return items.length <= 1 || !items.some(item => item.raw.includes('\n\n'));
  }

  private parseFenceAttributes(attributesStr: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    if (!attributesStr.trim()) return attributes;
    
    // Parse key=value pairs with optional quotes
    const regex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let match;
    
    while ((match = regex.exec(attributesStr)) !== null) {
      const key = match[1];
      const value = match[2] || match[3] || match[4]; // Double quoted, single quoted, or unquoted value
      
      // Special handling for 'attrs' key containing JSON
      if (key === 'attrs') {
        try {
          const parsedAttrs = JSON.parse(value);
          if (typeof parsedAttrs === 'object' && parsedAttrs !== null) {
            // Merge the parsed attributes into the main attributes object
            Object.assign(attributes, parsedAttrs);
            continue; // Don't add 'attrs' as a literal key
          }
        } catch (error) {
          // If JSON parsing fails, treat it as a regular attribute
          attributes[key] = value;
        }
      } else {
        attributes[key] = value;
      }
    }
    
    return attributes;
  }
}