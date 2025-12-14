/**
 * @file ASTBuilder.ts
 * @description Converts markdown tokens into ADF (Atlassian Document Format) structure
 * @author Extended ADF Parser
 */

import { Token, TokenType, ADFMetadata } from './types.js';
import { ADFDocument, ADFNode, ADFMark } from '../../types/adf.types.js';
import type { Root } from 'mdast';
import type { AdfFenceNode } from '../remark/adf-from-markdown.js';
import { getNodeMetadata, applyMetadataToAdfNode, generateMetadataComment, isAdfMetadataComment } from '../../utils/metadata-comments.js';
import { MarkdownTokenizer } from './MarkdownTokenizer.js';
import { getEmojiData, createFallbackEmojiData, type EmojiData } from '../../utils/emoji-mapping.js';

export interface ASTBuildOptions {
  strict?: boolean;
  preserveUnknownNodes?: boolean;
  defaultVersion?: number;
}

export class ASTBuilder {
  private options: ASTBuildOptions;

  constructor(options: ASTBuildOptions = {}) {
    this.options = {
      strict: false,
      preserveUnknownNodes: true,
      defaultVersion: 1,
      ...options
    };
  }

  /**
   * Build ADF document from markdown tokens
   */
  buildADF(tokens: Token[], frontmatter?: any): ADFDocument {
    // Filter out frontmatter token from content
    const contentTokens = tokens.filter(token => token.type !== 'frontmatter');
    
    // Extract document-level metadata from frontmatter
    const documentMetadata = this.extractDocumentMetadata(frontmatter);
    
    // Convert tokens to ADF nodes
    const content = this.convertTokensToNodes(contentTokens);
    
    // Post-process for nested ADF fence blocks with intelligent nesting detection
    const processedContent = this.postProcessNestedAdfFenceBlocks(content);

    return {
      version: this.options.defaultVersion!, // Always use default ADF version (1)
      type: 'doc',
      content: processedContent
    };
  }

  private extractDocumentMetadata(frontmatter?: any): { version?: number; [key: string]: any } {
    if (!frontmatter) return {};
    
    // Parse YAML frontmatter if it's a string
    if (typeof frontmatter === 'string') {
      try {
        // Simple YAML parsing for basic key: value pairs
        const lines = frontmatter.split('\n');
        const metadata: any = {};
        
        for (const line of lines) {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            // Try to parse numbers and booleans
            if (value === 'true') metadata[key] = true;
            else if (value === 'false') metadata[key] = false;
            else if (/^\d+$/.test(value)) metadata[key] = parseInt(value);
            else metadata[key] = value.replace(/['"]/g, ''); // Remove quotes
          }
        }
        
        return metadata;
      } catch {
        return {};
      }
    }
    
    return frontmatter;
  }

  private convertTokensToNodes(tokens: Token[]): ADFNode[] {
    const nodes: ADFNode[] = [];
    
    for (const token of tokens) {
      const node = this.convertTokenToNode(token);
      if (node) {
        nodes.push(node);
      }
    }
    
    return nodes;
  }

  private convertTokenToNode(token: Token): ADFNode | null {
    switch (token.type) {
      case 'heading':
        return this.convertHeading(token);
      case 'paragraph':
        return this.convertParagraph(token);
      case 'blockquote':
        return this.convertBlockquote(token);
      case 'codeBlock':
        return this.convertCodeBlock(token);
      case 'list':
        return this.convertList(token);
      case 'listItem':
        return this.convertListItem(token);
      case 'table':
        return this.convertTable(token);
      case 'tableRow':
        return this.convertTableRow(token);
      case 'tableHeader':
      case 'tableCell':
        return this.convertTableCell(token);
      case 'panel':
        return this.convertPanel(token);
      case 'expand':
        return this.convertExpand(token);
      case 'mediaSingle':
        return this.convertMediaSingle(token);
      case 'mediaGroup':
        return this.convertMediaGroup(token);
      case 'rule':
        return this.convertRule(token);
      case 'text':
        return this.convertText(token);
      case 'hardBreak':
        return this.convertHardBreak(token);
      default:
        return this.convertUnknownNode(token);
    }
  }

  private convertHeading(token: Token): ADFNode {
    const level = token.metadata?.attrs?.level || 1;
    const customAttrs = this.extractCustomAttributes(token.metadata, ['level']);
    
    // Use inline tokens if available (for social elements), otherwise parse content string
    const content = token.children && token.children.length > 0 
      ? this.convertInlineTokensToNodes(token.children)
      : this.convertInlineContent(token.content);
    
    return {
      type: 'heading',
      attrs: {
        level: Math.min(Math.max(level, 1), 6), // Clamp between 1-6
        ...customAttrs
      },
      content
    };
  }

  private convertParagraph(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    // Use inline tokens if available, otherwise parse content string
    const content = token.children && token.children.length > 0 
      ? this.convertInlineTokensToNodes(token.children)
      : this.convertInlineContent(token.content);
    
    // Check if this paragraph contains only a single mediaSingle element
    // If so, promote it to block level instead of keeping it as inline
    if (content.length === 1 && content[0].type === 'mediaSingle') {
      // Apply any paragraph-level attributes to the mediaSingle
      const mediaSingle = content[0];
      if (Object.keys(customAttrs).length > 0) {
        mediaSingle.attrs = { ...mediaSingle.attrs, ...customAttrs };
      }
      return mediaSingle;
    }
    
    const node: ADFNode = {
      type: 'paragraph',
      content
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertBlockquote(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const content = token.children ? 
      this.convertTokensToNodes(token.children) :
      [this.convertParagraph({ ...token, type: 'paragraph' })];

    const node: ADFNode = {
      type: 'blockquote',
      content
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertCodeBlock(token: Token): ADFNode {
    const language = token.metadata?.attrs?.language;
    const customAttrs = this.extractCustomAttributes(token.metadata, ['language']);
    
    const attrs: any = {};
    if (language) attrs.language = language;
    Object.assign(attrs, customAttrs);

    const node: ADFNode = {
      type: 'codeBlock',
      content: [
        {
          type: 'text',
          text: token.content
        }
      ]
    };

    if (Object.keys(attrs).length > 0) {
      node.attrs = attrs;
    }

    return node;
  }

  private convertList(token: Token): ADFNode {
    const listToken = token as any; // ListToken
    const isOrdered = listToken.ordered || false;
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const attrs: any = {};
    if (isOrdered && listToken.start && listToken.start !== 1) {
      attrs.order = listToken.start;
    }
    Object.assign(attrs, customAttrs);

    const node: ADFNode = {
      type: isOrdered ? 'orderedList' : 'bulletList',
      content: token.children ? this.convertTokensToNodes(token.children) : []
    };

    if (Object.keys(attrs).length > 0) {
      node.attrs = attrs;
    }

    return node;
  }

  private convertListItem(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const content = token.children ? 
      this.convertTokensToNodes(token.children) :
      token.content ? [this.convertParagraph({ ...token, type: 'paragraph' })] : [];

    const node: ADFNode = {
      type: 'listItem',
      content
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertTable(token: Token): ADFNode {
    const tableToken = token as any; // TableToken
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const attrs: any = {
      isNumberColumnEnabled: false,
      layout: 'default',
      ...customAttrs
    };

    return {
      type: 'table',
      attrs,
      content: token.children ? this.convertTokensToNodes(token.children) : []
    };
  }

  private convertTableRow(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const node: ADFNode = {
      type: 'tableRow',
      content: token.children ? this.convertTokensToNodes(token.children) : []
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertTableCell(token: Token): ADFNode {
    const isHeader = token.type === 'tableHeader';
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    // Use inline tokens if available (for social elements), otherwise parse content string
    const content = token.children && token.children.length > 0 
      ? this.convertInlineTokensToNodes(token.children)
      : this.convertInlineContent(token.content);
    
    const node: ADFNode = {
      type: isHeader ? 'tableHeader' : 'tableCell',
      content
    };

    const attrs: any = { ...customAttrs };
    
    // Handle cell spanning attributes
    if (attrs.colspan && attrs.colspan !== 1) {
      // Keep colspan as is
    } else {
      delete attrs.colspan;
    }
    
    if (attrs.rowspan && attrs.rowspan !== 1) {
      // Keep rowspan as is
    } else {
      delete attrs.rowspan;
    }

    if (Object.keys(attrs).length > 0) {
      node.attrs = attrs;
    }

    return node;
  }

  private convertPanel(token: Token): ADFNode {
    const fenceToken = token as any; // FenceToken
    const panelType = fenceToken.attributes?.type || 'info';
    const customAttrs = this.extractCustomAttributes(token.metadata, ['type']);
    
    // Also get attributes from fence parsing
    const fenceAttrs = { ...fenceToken.attributes };
    delete fenceAttrs.type; // Remove type as it's handled separately
    
    // The 'attrs' JSON parsing should be handled by the micromark extension
    // If we still see an 'attrs' string here, it means the micromark parsing failed
    
    const content = token.children ? 
      this.convertTokensToNodes(token.children) :
      token.content ? this.parseBlockContentWithSocialElements(token.content) : [];

    return {
      type: 'panel',
      attrs: {
        panelType,
        ...fenceAttrs,
        ...customAttrs
      },
      content
    };
  }

  private convertExpand(token: Token): ADFNode {
    const fenceToken = token as any; // FenceToken
    const title = fenceToken.attributes?.title || '';
    const customAttrs = this.extractCustomAttributes(token.metadata, ['title']);
    
    // Also get attributes from fence parsing
    const fenceAttrs = { ...fenceToken.attributes };
    delete fenceAttrs.title; // Remove title as it's handled separately
    
    // The 'attrs' JSON parsing should be handled by the micromark extension
    
    
    const content = token.children ? 
      this.convertTokensToNodes(token.children) :
      token.content ? this.parseBlockContentWithSocialElements(token.content) : [];

    const attrs: any = { ...fenceAttrs, ...customAttrs };
    if (title) attrs.title = title;

    return {
      type: 'expand',
      attrs,
      content
    };
  }

  private convertMediaSingle(token: Token): ADFNode {
    const fenceToken = token as any; // FenceToken
    const layout = fenceToken.attributes?.layout || 'center';
    const width = fenceToken.attributes?.width;
    const customAttrs = this.extractCustomAttributes(token.metadata, ['layout', 'width']);
    
    const attrs: any = { layout, ...customAttrs };
    if (width) attrs.width = parseInt(width) || width;

    // Extract media nodes from content
    const mediaNodes = this.extractMediaFromContent(token.content);

    return {
      type: 'mediaSingle',
      attrs,
      content: mediaNodes
    };
  }

  private convertMediaGroup(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    // For mediaGroup, extract mediaReference nodes directly using regex
    // instead of going through normal token processing that creates mediaSingle nodes
    let mediaNodes: ADFNode[] = [];
    
    // Get the raw content string
    const rawContent = token.content || token.raw || '';
    
    // Extract media references using regex pattern (same as social element processing)
    const mediaRegex = /!\[([^\]]*)\]\(media:([^)]+)\)/g;
    let match;
    
    while ((match = mediaRegex.exec(rawContent)) !== null) {
      const [, alt, id] = match;
      
      mediaNodes.push({
        type: 'mediaReference',
        attrs: {
          id,
          alt: alt || '',
          mediaType: 'file',
          collection: ''
        }
      });
    }

    const node: ADFNode = {
      type: 'mediaGroup',
      content: mediaNodes
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertRule(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const node: ADFNode = {
      type: 'rule'
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertText(token: Token): ADFNode {
    // Check if this token has metadata with marks (from span-style comments)
    if (token.metadata?.marks && Array.isArray(token.metadata.marks)) {
      const metadata = token.metadata;
      if (metadata && metadata.marks && Array.isArray(metadata.marks)) {
        // Create text node with the marks from metadata
        return {
          type: 'text',
          text: token.content,
          marks: metadata.marks
        };
      }
    }
    
    return {
      type: 'text',
      text: token.content
    };
  }

  private convertHardBreak(token: Token): ADFNode {
    const customAttrs = this.extractCustomAttributes(token.metadata);
    
    const node: ADFNode = {
      type: 'hardBreak'
    };

    if (Object.keys(customAttrs).length > 0) {
      node.attrs = customAttrs;
    }

    return node;
  }

  private convertUnknownNode(token: Token): ADFNode | null {
    if (!this.options.preserveUnknownNodes) {
      return null;
    }

    // Convert unknown nodes to comments or fallback format
    return {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `[Unknown node type: ${token.type}]`
        }
      ]
    };
  }

  private convertInlineTokensToNodes(tokens: Token[]): ADFNode[] {
    const nodes: ADFNode[] = [];
    
    for (const token of tokens) {
      const convertedNodes = this.convertInlineTokenToNode(token);
      nodes.push(...convertedNodes);
    }
    
    return nodes;
  }
  
  private convertInlineTokenToNode(token: Token): ADFNode[] {
    switch (token.type) {
      case 'text':
        // Check if text contains social elements that need parsing
        if (this.hasSocialElements(token.content)) {
          return this.parseInlineContentWithSocialElements(token.content);
        }
        return [{
          type: 'text',
          text: token.content
        }];
        
      case 'strong':
      case 'emphasis': 
      case 'strikethrough':
      case 'inlineCode':
      case 'underline':
        return this.convertFormattingToken(token);
        
      case 'link':
        return this.convertLinkToken(token);
        
      default:
        // Unknown inline token type, treat as plain text
        return [{
          type: 'text',
          text: token.content || token.raw
        }];
    }
  }
  
  private convertFormattingToken(token: Token): ADFNode[] {
    const markType = this.getADFMarkType(token.type);
    
    // If token has children (nested formatting), process them
    if (token.children && token.children.length > 0) {
      const childNodes = this.convertInlineTokensToNodes(token.children);
      
      // Apply the mark to all child text nodes
      return childNodes.map(node => {
        if (node.type === 'text') {
          const marks = node.marks ? [...node.marks] : [];
          marks.push({ type: markType });
          return {
            ...node,
            marks
          };
        }
        return node;
      });
    } else {
      // Simple formatting token
      return [{
        type: 'text',
        text: token.content,
        marks: [{ type: markType }]
      }];
    }
  }
  
  private getADFMarkType(tokenType: string): string {
    switch (tokenType) {
      case 'strong': return 'strong';
      case 'emphasis': return 'em';
      case 'strikethrough': return 'strike';
      case 'inlineCode': return 'code';
      case 'underline': return 'underline';
      default: return 'unknown';
    }
  }
  
  private convertLinkToken(token: Token): ADFNode[] {
    const href = token.metadata?.attrs?.href;
    const title = token.metadata?.attrs?.title;
    
    if (!href) {
      // Invalid link, treat as plain text
      return [{
        type: 'text',
        text: token.content || token.raw
      }];
    }
    
    // Create link mark attributes
    const linkAttrs: any = { href };
    if (title) {
      linkAttrs.title = title;
    }
    
    // If token has children (formatted link text), process them
    if (token.children && token.children.length > 0) {
      const childNodes = this.convertInlineTokensToNodes(token.children);
      
      // Apply the link mark to all child text nodes
      return childNodes.map(node => {
        if (node.type === 'text') {
          const marks = node.marks ? [...node.marks] : [];
          marks.push({ type: 'link', attrs: linkAttrs });
          return {
            ...node,
            marks
          };
        }
        return node;
      });
    } else {
      // Simple link token
      return [{
        type: 'text',
        text: token.content || 'link',
        marks: [{ type: 'link', attrs: linkAttrs }]
      }];
    }
  }

  private convertInlineContent(content: string): ADFNode[] {
    if (!content.trim()) {
      return [];
    }

    // Parse inline markdown content (simplified version)
    const inlineNodes = this.parseInlineMarkdown(content);
    return inlineNodes;
  }

  private parseInlineMarkdown(content: string): ADFNode[] {
    // First parse social elements and special syntax before standard markdown processing
    return this.parseInlineContentWithSocialElements(content);
  }

  /**
   * Get emoji data for a shortname, with fallback for unknown emojis
   */
  private getEmojiData(shortName: string): EmojiData {
    const emojiData = getEmojiData(shortName);
    return emojiData || createFallbackEmojiData(shortName);
  }

  /**
   * Check if content contains social elements that need special parsing
   */
  private hasSocialElements(content: string): boolean {
    if (!content) return false;
    
    // Check for social element patterns
    return (
      content.includes('{user:') ||    // User mentions
      /:[a-zA-Z0-9_+-]+:/.test(content) ||  // Emoji patterns  
      content.includes('{date:') ||    // Date elements with braces
      /(^|[^\w-])\d{4}-\d{2}-\d{2}(?![\w-])/.test(content) ||  // Standalone dates YYYY-MM-DD
      content.includes('{status:')     // Status elements
    );
  }

  /**
   * Parse inline content with support for social elements and special ADF syntax
   */
  private parseInlineContentWithSocialElements(content: string): ADFNode[] {
    if (!content) return [];


    const nodes: ADFNode[] = [];
    let remaining = content;

    while (remaining.length > 0) {
      // Try to match social elements and special syntax first
      const socialMatch = this.findNextSocialElement(remaining);
      
      if (socialMatch) {
        
        // Add text before the social element
        if (socialMatch.beforeText) {
          nodes.push(...this.parseInlineMarksRecursively(socialMatch.beforeText));
        }
        
        // Add the social element node
        nodes.push(socialMatch.node);
        
        // Continue with remaining content
        remaining = socialMatch.afterText;
      } else {
        // No more social elements, process remaining content as regular markdown
        nodes.push(...this.parseInlineMarksRecursively(remaining));
        break;
      }
    }


    return nodes;
  }

  /**
   * Find the next social element in the content
   */
  private findNextSocialElement(content: string): { beforeText: string; node: ADFNode; afterText: string } | null {
    // Define patterns for social elements (order matters - most specific first)
    const patterns = [
      // User mentions: {user:username} or {user:user-id-123}
      {
        regex: /\{user:([^}]+)\}/,
        type: 'mention',
        process: (match: RegExpMatchArray) => ({
          type: 'mention' as const,
          attrs: {
            id: match[1],
            text: `@${match[1]}`,
            userType: 'DEFAULT'
          }
        })
      },
      // Emoji: :emoji_name:
      {
        regex: /:([a-zA-Z0-9_+-]+):/,
        type: 'emoji',
        process: (match: RegExpMatchArray) => {
          const shortName = match[1];
          const emojiData = this.getEmojiData(shortName);
          
          return {
            type: 'emoji' as const,
            attrs: {
              shortName: `:${shortName}:`, // Include colons in shortName per Atlassian docs
              id: emojiData.id,
              text: emojiData.text
            }
          };
        }
      },
      // Date: {date:YYYY-MM-DD}
      {
        regex: /\{date:(\d{4}-\d{2}-\d{2})\}/,
        type: 'date',
        process: (match: RegExpMatchArray) => {
          const dateString = match[1];
          const date = new Date(dateString + 'T00:00:00.000Z');
          const timestamp = date.getTime().toString();
          
          return {
            type: 'date' as const,
            attrs: {
              timestamp
            }
          };
        }
      },
      // Standalone date: YYYY-MM-DD (must be word-bounded to avoid partial matches)
      {
        regex: /(^|[^\w-])(\d{4}-\d{2}-\d{2})(?![\w-])/,
        type: 'date',
        process: (match: RegExpMatchArray) => {
          const dateString = match[2]; // Second capture group since we have boundary check
          const date = new Date(dateString + 'T00:00:00.000Z');
          const timestamp = date.getTime().toString();
          
          return {
            type: 'date' as const,
            attrs: {
              timestamp
            }
          };
        }
      },
      // Status: {status:status text} or {status:status text|color:colorname}
      {
        regex: /\{status:([^|}]+)(?:\|color:([^}]*))?\}/,
        type: 'status',
        process: (match: RegExpMatchArray) => {
          const text = match[1];
          const color = match[2] || 'neutral'; // Default to neutral if no color specified
          
          // Validate color against official Atlassian colors
          const validColors = ['neutral', 'purple', 'blue', 'red', 'yellow', 'green'];
          const finalColor = (color && validColors.includes(color)) ? color : 'neutral';
          
          return {
            type: 'status' as const,
            attrs: {
              text,
              color: finalColor
            }
          };
        }
      },
      // Inline cards: [text](card:url)
      {
        regex: /\[([^\]]*)\]\(card:([^)]+)\)/,
        type: 'inlineCard',
        process: (match: RegExpMatchArray) => ({
          type: 'inlineCard' as const,
          attrs: {
            url: match[2]
          }
        })
      },
      // Media references: ![alt text](media:id) (return special type for block processing)
      {
        regex: /!\[([^\]]*)\]\(media:([^)]+)\)/,
        type: 'mediaReference',
        process: (match: RegExpMatchArray) => {
          const [, alt, id] = match;
          // Return a special node type that will be converted to mediaSingle at block level
          return {
            type: 'mediaReference' as const,
            attrs: {
              id,
              alt: alt || '',
              mediaType: 'file',
              collection: ''
            }
          };
        }
      }
    ];

    let earliestMatch: { index: number; beforeText: string; node: ADFNode; afterText: string } | null = null;

    for (const pattern of patterns) {
      const match = content.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          const beforeText = content.substring(0, match.index);
          const afterText = content.substring(match.index + match[0].length);
          const node = pattern.process(match);
          
          earliestMatch = {
            index: match.index,
            beforeText,
            node,
            afterText
          };
        }
      }
    }

    return earliestMatch;
  }

  /**
   * Process a text node for social elements and return array of ADF nodes
   */
  private processTextNodeForSocialElements(text: string): ADFNode[] {
    if (!text) return [];

    // Use the same social element parsing logic
    return this.parseInlineContentWithSocialElements(text);
  }

  /**
   * Find and process metadata comments for advanced formatting
   */
  private findNextMetadataComment(content: string): { beforeText: string; node: ADFNode; afterText: string } | null {
    // Pattern for metadata comments: <!-- adf:text attr=value ... -->text<!-- /adf:text -->
    const metadataRegex = /<!--\s*adf:text\s+([^>]+)-->(.*?)<!--\s*\/adf:text\s*-->/;
    const match = content.match(metadataRegex);
    
    if (!match || match.index === undefined) {
      return null;
    }
    
    const [fullMatch, attributes, text] = match;
    const beforeText = content.substring(0, match.index);
    const afterText = content.substring(match.index + fullMatch.length);
    
    // Parse attributes
    const marks: any[] = [];
    const attrs = attributes.trim();
    
    // Parse individual attributes
    const attrMatches = attrs.matchAll(/(\w+)=(?:([^"\s]+)|"([^"]*)")/g);
    for (const attrMatch of attrMatches) {
      const [, attrName, unquotedValue, quotedValue] = attrMatch;
      const value = quotedValue !== undefined ? quotedValue : unquotedValue;
      
      switch (attrName) {
        case 'underline':
          if (value === 'true') {
            marks.push({ type: 'underline' });
          }
          break;
        case 'color':
          marks.push({ type: 'textColor', attrs: { color: value } });
          break;
        case 'backgroundColor':
          marks.push({ type: 'backgroundColor', attrs: { color: value } });
          break;
        case 'subscript':
          if (value === 'true') {
            marks.push({ type: 'subsup', attrs: { type: 'sub' } });
          }
          break;
        case 'superscript':
          if (value === 'true') {
            marks.push({ type: 'subsup', attrs: { type: 'sup' } });
          }
          break;
      }
    }
    
    const node: ADFNode = {
      type: 'text',
      text,
      ...(marks.length > 0 && { marks })
    };
    
    return {
      beforeText,
      node,
      afterText
    };
  }

  private parseInlineMarksRecursively(content: string): ADFNode[] {
    if (!content) return [];
    
    const nodes: ADFNode[] = [];
    
    // First check for metadata comment formatting
    const metadataMatch = this.findNextMetadataComment(content);
    if (metadataMatch) {
      // Add text before the metadata comment
      if (metadataMatch.beforeText) {
        nodes.push(...this.parseInlineMarksRecursively(metadataMatch.beforeText));
      }
      
      // Add the formatted text node
      nodes.push(metadataMatch.node);
      
      // Continue with remaining content
      nodes.push(...this.parseInlineMarksRecursively(metadataMatch.afterText));
      return nodes;
    }
    
    // Patterns for inline formatting (order matters for precedence)
    const patterns = [
      // Inline cards: [text](url)<!-- adf:inlineCard -->
      { 
        regex: /\[([^\]]+)\]\(([^)]+)\)<!--\s*adf:inlineCard\s*-->/,
        type: 'inlineCard',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, linkText, href] = match;
          return {
            before,
            node: {
              type: 'inlineCard',
              attrs: { url: href }
            },
            after
          };
        }
      },
      // Inline cards: [text](card:url)
      { 
        regex: /\[([^\]]*)\]\(card:([^)]+)\)/,
        type: 'inlineCard',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, linkText, url] = match;
          return {
            before,
            node: {
              type: 'inlineCard',
              attrs: { url }
            },
            after
          };
        }
      },
      // Regular links: [text](url)
      { 
        regex: /\[([^\]]+)\]\(([^)]+)\)/,
        type: 'link',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, linkText, href] = match;
          return {
            before,
            node: {
              type: 'text',
              text: linkText,
              marks: [{ type: 'link', attrs: { href } }]
            },
            after
          };
        }
      },
      // Bold: **text**
      {
        regex: /\*\*([^*]+)\*\*/,
        type: 'strong',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, boldText] = match;
          return {
            before,
            node: {
              type: 'text',
              text: boldText,
              marks: [{ type: 'strong' }]
            },
            after
          };
        }
      },
      // Italic: *text* (but not **text**)
      {
        regex: /(?<!\*)\*([^*]+)\*(?!\*)/,
        type: 'em',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, italicText] = match;
          return {
            before,
            node: {
              type: 'text',
              text: italicText,
              marks: [{ type: 'em' }]
            },
            after
          };
        }
      },
      // Inline code: `text`
      {
        regex: /`([^`]+)`/,
        type: 'code',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, codeText] = match;
          return {
            before,
            node: {
              type: 'text',
              text: codeText,
              marks: [{ type: 'code' }]
            },
            after
          };
        }
      },
      // Advanced formatting with metadata comments: <!-- adf:text attributes -->text<!-- /adf:text -->
      {
        regex: /<!--\s*adf:text\s+([^>]+)\s*-->([^<]+)<!--\s*\/adf:text\s*-->/,
        type: 'advancedText',
        process: (match: RegExpMatchArray, before: string, after: string) => {
          const [fullMatch, attributesStr, text] = match;
          const marks: any[] = [];
          
          // Parse attributes from the comment
          try {
            // Handle key=value pairs
            const attrMatches = attributesStr.matchAll(/(\w+)=["']?([^"'\s]+)["']?/g);
            for (const attrMatch of attrMatches) {
              const [, key, value] = attrMatch;
              switch (key) {
                case 'underline':
                  if (value === 'true') {
                    marks.push({ type: 'underline' });
                  }
                  break;
                case 'textColor':
                  marks.push({ type: 'textColor', attrs: { color: value } });
                  break;
                case 'backgroundColor':
                  marks.push({ type: 'backgroundColor', attrs: { color: value } });
                  break;
                case 'subsup':
                  marks.push({ type: 'subsup', attrs: { type: value } }); // 'sub' or 'sup'
                  break;
              }
            }
          } catch (error) {
            // If parsing fails, treat as regular text
          }
          
          return {
            before,
            node: {
              type: 'text',
              text: text.trim(),
              ...(marks.length > 0 && { marks })
            },
            after
          };
        }
      }
    ];

    // Find the first matching pattern
    let firstMatch: { match: RegExpMatchArray; pattern: any; index: number } | null = null;
    for (const pattern of patterns) {
      const match = content.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!firstMatch || match.index < firstMatch.index) {
          firstMatch = { match, pattern, index: match.index };
        }
      }
    }

    if (!firstMatch) {
      // No formatting found, return plain text
      return content ? [{ type: 'text', text: content }] : [];
    }

    const { match, pattern } = firstMatch;
    const before = content.substring(0, match.index!);
    const after = content.substring(match.index! + match[0].length);

    const result = pattern.process(match, before, after);

    // Recursively process before and after sections
    const beforeNodes = result.before ? this.parseInlineMarksRecursively(result.before) : [];
    const afterNodes = result.after ? this.parseInlineMarksRecursively(result.after) : [];

    return [...beforeNodes, result.node, ...afterNodes];
  }

  private expandPlaceholderURLs(content: string): string {
    // Convert placeholder URLs back to descriptions
    // {media:123} -> "Media 123"
    // {user:456} -> "User 456"
    return content
      .replace(/\{media:([^}]+)\}/g, 'Media $1')
      .replace(/\{user:([^}]+)\}/g, 'User $1')
      .replace(/\{card:([^}]+)\}/g, 'Card: $1');
  }

  private extractMediaFromContent(content: string): ADFNode[] {
    const mediaNodes: ADFNode[] = [];
    
    // Look for markdown images with media placeholders - use media:id pattern (not {media:id})
    const mediaRegex = /!\[([^\]]*)\]\(media:([^)]+)\)(?:\s*<!-- adf:media ([^>]*) -->)?/g;
    let match;
    
    while ((match = mediaRegex.exec(content)) !== null) {
      const [, alt, id, metadataStr] = match;
      
      let attrs: any = { id, type: 'file' };
      
      // Parse media metadata if present
      if (metadataStr) {
        try {
          const metadata = JSON.parse(metadataStr.replace(/'/g, '"'));
          attrs = { ...attrs, ...metadata };
        } catch {
          // Invalid metadata, use defaults
        }
      }
      
      if (alt) attrs.alt = alt;
      
      mediaNodes.push({
        type: 'media',
        attrs
      });
    }
    
    // If no media found, return empty array
    return mediaNodes;
  }

  private extractCustomAttributes(metadata?: ADFMetadata, excludeKeys: string[] = []): Record<string, any> {
    if (!metadata?.attrs) return {};
    
    const customAttrs: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata.attrs)) {
      if (!excludeKeys.includes(key)) {
        customAttrs[key] = value;
      }
    }
    
    return customAttrs;
  }

  /**
   * Build ADF document from mdast tree (for enhanced parser)
   */
  buildADFFromMdast(tree: Root, frontmatter?: any): ADFDocument {
    // Extract document metadata from frontmatter
    const documentMetadata = this.extractDocumentMetadata(frontmatter);
    
    // Convert mdast nodes to ADF nodes
    const content = this.convertMdastNodesToADF(tree.children);

    return {
      version: this.options.defaultVersion!,
      type: 'doc',
      content
    };
  }

  /**
   * Build mdast tree from ADF document (for stringify)
   */
  buildMdastFromADF(adf: ADFDocument): Root {
    const children = this.convertAdfNodesToMdast(adf.content);
    
    return {
      type: 'root',
      children
    };
  }

  /**
   * Convert mdast nodes to ADF nodes
   */
  public convertMdastNodesToADF(nodes: any[]): ADFNode[] {
    const adfNodes: ADFNode[] = [];
    
    for (const node of nodes) {
      const adfNode = this.convertMdastNodeToADF(node);
      if (adfNode) {
        // Handle special case for multiple nodes from social elements
        if ((adfNode as any).__multipleNodes) {
          adfNodes.push(...(adfNode as any).__multipleNodes);
        } else {
          adfNodes.push(adfNode);
        }
      }
    }
    
    return adfNodes;
  }

  /**
   * Convert single mdast node to ADF node
   */
  private convertMdastNodeToADF(node: any): ADFNode | null {
    let adfNode: ADFNode | null = null;
    
    switch (node.type) {
      case 'heading':
        adfNode = this.convertMdastHeading(node);
        break;
      case 'paragraph':
        adfNode = this.convertMdastParagraph(node);
        break;
      case 'blockquote':
        adfNode = this.convertMdastBlockquote(node);
        break;
      case 'code':
        adfNode = this.convertMdastCodeBlock(node);
        break;
      case 'list':
        adfNode = this.convertMdastList(node);
        break;
      case 'listItem':
        adfNode = this.convertMdastListItem(node);
        break;
      case 'table':
        adfNode = this.convertMdastTable(node);
        break;
      case 'tableRow':
        adfNode = this.convertMdastTableRow(node);
        break;
      case 'tableCell':
        adfNode = this.convertMdastTableCell(node);
        break;
      case 'thematicBreak':
        adfNode = { type: 'rule' };
        break;
      case 'adfFence':
        adfNode = this.convertAdfFenceNode(node as AdfFenceNode);
        break;
      case 'strong':
        adfNode = this.convertMdastStrong(node);
        break;
      case 'emphasis':
        adfNode = this.convertMdastEmphasis(node);
        break;
      case 'inlineCode':
        adfNode = this.convertMdastInlineCode(node);
        break;
      case 'link':
        adfNode = this.convertMdastLink(node);
        break;
      case 'yaml':
      case 'toml':
        // Skip frontmatter nodes - they're handled separately
        return null;
      case 'text':
        // Check if this text node has metadata with marks (from span-style comments)
        if (node.data?.adfMetadata && Array.isArray(node.data.adfMetadata)) {
          console.log('DEBUG: Found adfMetadata:', JSON.stringify(node.data.adfMetadata, null, 2));
          const metadata = node.data.adfMetadata[0];
          if (metadata && metadata.marks && Array.isArray(metadata.marks)) {
            console.log('DEBUG: Found marks:', JSON.stringify(metadata.marks, null, 2));
            // Create text node with the marks from metadata
            adfNode = {
              type: 'text',
              text: node.value,
              marks: metadata.marks
            };
            console.log('DEBUG: Created ADF node with marks:', JSON.stringify(adfNode, null, 2));
            break;
          }
        }
        
        // Process text node for social elements and special syntax
        // Note: This returns an array, but we need to handle it in the calling function
        const processedNodes = this.processTextNodeForSocialElements(node.value);
        if (processedNodes.length === 1) {
          adfNode = processedNodes[0];
        } else if (processedNodes.length > 1) {
          // Return multiple nodes as a special marker that the parent can handle
          return { __multipleNodes: processedNodes } as any;
        } else {
          // Empty result, create empty text node
          adfNode = { type: 'text', text: '' };
        }
        break;
      case 'image':
        adfNode = this.convertMdastImage(node);
        break;
      case 'html':
        // Skip ADF metadata comments - they should have been processed already
        if (node.value && isAdfMetadataComment(node.value)) {
          return null;
        }
        // Skip ADF processing directives (like inlineCard, blockCard)
        if (node.value && this.isAdfProcessingDirective(node.value)) {
          return null;
        }
        // For other HTML nodes, preserve as unknown if option is set
        if (this.options.preserveUnknownNodes) {
          adfNode = {
            type: 'paragraph',
            content: [{ type: 'text', text: `[HTML: ${node.value}]` }]
          };
        } else {
          return null;
        }
        break;
      default:
        if (this.options.preserveUnknownNodes) {
          adfNode = {
            type: 'paragraph',
            content: [{ type: 'text', text: `[Unknown node: ${node.type}]` }]
          };
        } else {
          return null;
        }
        break;
    }

    // Apply metadata from HTML comments if present
    if (adfNode) {
      const metadata = getNodeMetadata(node);
      if (metadata.length > 0) {
        adfNode = applyMetadataToAdfNode(adfNode, metadata);
      }
    }

    return adfNode;
  }

  /**
   * Convert ADF fence node from micromark extension
   */
  private convertAdfFenceNode(node: AdfFenceNode): ADFNode {
    const { nodeType, attributes, value } = node;
    
    
    // Parse the content - prioritize children over value
    let content: ADFNode[] = [];
    
    // Check if we have parsed children (from enhanced processing)
    if ('children' in node && Array.isArray(node.children) && node.children.length > 0) {
      // Convert children mdast nodes to ADF nodes
      content = node.children
        .map(child => this.convertMdastNodeToADF(child))
        .filter((adfNode): adfNode is ADFNode => adfNode !== null);
    } else if (value && value.trim()) {
      // Parse the raw content as full markdown blocks (including lists, multiple paragraphs, etc.)
      content = this.parseBlockContentWithSocialElements(value.trim());
    }

    // Create the appropriate ADF node based on nodeType
    switch (nodeType) {
      case 'panel':
        return {
          type: 'panel',
          attrs: {
            panelType: attributes.type || 'info',
            ...this.filterAttributes(attributes, ['type'])
          },
          content
        };
      
      case 'expand':
        return {
          type: 'expand',
          attrs: {
            ...(attributes.title && { title: attributes.title }),
            ...this.filterAttributes(attributes, ['title'])
          },
          content
        };
      
      case 'nestedExpand':
        return {
          type: 'nestedExpand',
          attrs: {
            ...(attributes.title && { title: attributes.title }),
            ...this.filterAttributes(attributes, ['title'])
          },
          content
        };
      
      case 'mediaSingle':
        const mediaNodes = this.extractMediaFromContent(value);
        return {
          type: 'mediaSingle',
          attrs: {
            ...(attributes.layout && { layout: attributes.layout }),
            ...(attributes.width && { width: attributes.width }),
            ...this.filterAttributes(attributes, ['layout', 'width'])
          },
          content: mediaNodes.length > 0 ? mediaNodes : content
        };
      
      case 'mediaGroup':
        // Use the same logic as the direct tokenizer path to create mediaReference nodes
        let groupMediaNodes: ADFNode[] = [];
        
        if (value && value.trim()) {
          // Extract media references using regex pattern (same as convertMediaGroup)
          const mediaRegex = /!\[([^\]]*)\]\(media:([^)]+)\)/g;
          let match;
          
          while ((match = mediaRegex.exec(value)) !== null) {
            const [, alt, id] = match;
            
            groupMediaNodes.push({
              type: 'mediaReference',
              attrs: {
                id,
                alt: alt || '',
                mediaType: 'file',
                collection: ''
              }
            });
          }
        }
        
        // If regex didn't find anything, extract from processed content
        if (groupMediaNodes.length === 0 && content.length > 0) {
          // Extract media references from all content nodes
          for (const node of content) {
            if (node.type === 'paragraph' && node.content) {
              const mediaRefs = node.content.filter((child: ADFNode) => 
                child.type === 'mediaReference' || child.type === 'media'
              );
              groupMediaNodes.push(...mediaRefs);
            } else if (node.type === 'mediaReference' || node.type === 'media') {
              groupMediaNodes.push(node);
            }
          }
        }
        
        return {
          type: 'mediaGroup',
          content: groupMediaNodes.length > 0 ? groupMediaNodes : content
        };
      
      default:
        // Unknown ADF node type, preserve as a generic node
        return {
          type: 'paragraph',
          content: [
            { 
              type: 'text', 
              text: `[ADF ${nodeType}]: ${value || ''}`
            }
          ]
        };
    }
  }

  /**
   * Convert mdast nodes to corresponding format
   */
  private convertMdastHeading(node: any): ADFNode {
    return {
      type: 'heading',
      attrs: { level: node.depth },
      content: this.convertMdastInlineNodes(node.children)
    };
  }

  private convertMdastParagraph(node: any): ADFNode | null {
    // Check if this paragraph contains only a single image that's an ADF media placeholder
    if (node.children && node.children.length === 1 && node.children[0].type === 'image') {
      const imageNode = node.children[0];
      if (imageNode.url && imageNode.url.match(/^(?:adf:)?media:/)) {
        // This is a standalone media element - convert it to block-level media/mediaSingle
        // Transfer any paragraph-level metadata to the image node
        const paragraphMetadata = getNodeMetadata(node);
        if (paragraphMetadata.length > 0) {
          // Add paragraph metadata to image node
          if (!imageNode.data) {
            imageNode.data = {};
          }
          if (!imageNode.data.adfMetadata) {
            imageNode.data.adfMetadata = [];
          }
          imageNode.data.adfMetadata.push(...paragraphMetadata);
        }
        
        const mediaNode = this.convertMdastImage(imageNode);
        if (mediaNode) {
          return mediaNode;
        }
      }
    }
    
    const content = this.convertMdastInlineNodes(node.children);
    
    // If paragraph content is completely empty, return null to filter it out
    // This happens when all content was ignored (e.g., regular images)
    if (content.length === 0) {
      return null;
    }
    
    // Post-process inline cards: convert link marks that should be inline cards
    const processedContent = this.postProcessInlineCards(content, node.children);
    
    return {
      type: 'paragraph',
      content: processedContent
    };
  }

  /**
   * Post-process content to convert link marks to inline cards when appropriate
   */
  /**
   * Check if an HTML comment is an ADF processing directive
   */
  private isAdfProcessingDirective(value: string): boolean {
    const processingDirectives = ['inlineCard', 'blockCard'];
    return processingDirectives.some(directive => 
      value.includes(`adf:${directive}`)
    );
  }

  private postProcessInlineCards(content: ADFNode[], originalNodes: any[]): ADFNode[] {
    // Process inline cards properly - only convert links that have explicit adf:inlineCard metadata
    if (!originalNodes || originalNodes.length === 0) {
      return content;
    }

    // Find links that should become inline cards by looking for adf:inlineCard comments that follow links
    const linksToConvert = new Set<string>();
    
    for (let i = 0; i < originalNodes.length - 1; i++) {
      const currentNode = originalNodes[i];
      const nextNode = originalNodes[i + 1];
      
      // Check if current node is a link and next node is an adf:inlineCard comment
      if (currentNode.type === 'link' && 
          nextNode.type === 'html' && 
          nextNode.value?.includes('adf:inlineCard')) {
        linksToConvert.add(currentNode.url);
      }
    }

    if (linksToConvert.size === 0) {
      return content;
    }

    // Convert only the specific links that have comments
    return content.map(node => {
      if (node.type === 'text' && node.marks?.some(mark => mark.type === 'link')) {
        const linkMark = node.marks.find(mark => mark.type === 'link');
        if (linkMark?.attrs?.href && linksToConvert.has(linkMark.attrs.href)) {
          return {
            type: 'inlineCard',
            attrs: {
              url: linkMark.attrs.href
            }
          };
        }
      }
      return node;
    });
  }

  private convertMdastBlockquote(node: any): ADFNode {
    return {
      type: 'blockquote',
      content: this.convertMdastNodesToADF(node.children)
    };
  }

  private convertMdastCodeBlock(node: any): ADFNode {
    return {
      type: 'codeBlock',
      attrs: node.lang ? { language: node.lang } : {},
      content: [{ type: 'text', text: node.value }]
    };
  }

  private convertMdastList(node: any): ADFNode {
    return {
      type: node.ordered ? 'orderedList' : 'bulletList',
      ...(node.start && node.start !== 1 && { attrs: { order: node.start } }),
      content: this.convertMdastNodesToADF(node.children)
    };
  }

  private convertMdastListItem(node: any): ADFNode {
    return {
      type: 'listItem',
      content: this.convertMdastNodesToADF(node.children)
    };
  }

  private convertMdastTable(node: any): ADFNode {
    const rows = [];
    
    for (let i = 0; i < node.children.length; i++) {
      const rowNode = node.children[i];
      const isFirstRow = i === 0;
      
      if (rowNode.type === 'tableRow') {
        const cells = [];
        for (const cellNode of rowNode.children) {
          if (cellNode.type === 'tableCell') {
            cells.push(this.convertMdastTableCell(cellNode, isFirstRow));
          }
        }
        
        rows.push({
          type: 'tableRow',
          content: cells
        });
      }
    }
    
    return {
      type: 'table',
      content: rows
    };
  }

  private convertMdastTableRow(node: any): ADFNode {
    return {
      type: 'tableRow',
      content: this.convertMdastNodesToADF(node.children)
    };
  }

  private convertMdastTableCell(node: any, isHeader = false): ADFNode {
    const adfNode: ADFNode = {
      type: isHeader ? 'tableHeader' : 'tableCell',
      content: this.convertMdastNodesToADF(node.children)
    };

    // Apply metadata if available
    if (node.data?.adfMetadata) {
      const metadata = Array.isArray(node.data.adfMetadata) ? node.data.adfMetadata : [node.data.adfMetadata];
      return applyMetadataToAdfNode(adfNode, metadata);
    }

    return adfNode;
  }

  /**
   * Convert mdast strong (bold) node to ADF text with strong mark
   */
  private convertMdastStrong(node: any): ADFNode {
    // Convert children and wrap in paragraph if needed
    const content = this.convertMdastNodesToADF(node.children);
    
    // If content is text nodes, add strong marks
    const processedContent = content.map(child => {
      if (child.type === 'text') {
        const marks = child.marks || [];
        return {
          ...child,
          marks: [...marks, { type: 'strong' }]
        };
      }
      return child;
    });

    // Return wrapped in paragraph if we have multiple nodes
    if (processedContent.length === 1 && processedContent[0].type === 'text') {
      return processedContent[0];
    }
    
    return {
      type: 'paragraph',
      content: processedContent
    };
  }

  /**
   * Convert mdast emphasis (italic) node to ADF text with em mark
   */
  private convertMdastEmphasis(node: any): ADFNode {
    // Convert children and wrap in paragraph if needed
    const content = this.convertMdastNodesToADF(node.children);
    
    // If content is text nodes, add em marks
    const processedContent = content.map(child => {
      if (child.type === 'text') {
        const marks = child.marks || [];
        return {
          ...child,
          marks: [...marks, { type: 'em' }]
        };
      }
      return child;
    });

    // Return wrapped in paragraph if we have multiple nodes
    if (processedContent.length === 1 && processedContent[0].type === 'text') {
      return processedContent[0];
    }
    
    return {
      type: 'paragraph',
      content: processedContent
    };
  }

  /**
   * Convert mdast inlineCode node to ADF text with code mark
   */
  private convertMdastInlineCode(node: any): ADFNode {
    return {
      type: 'text',
      text: node.value,
      marks: [{ type: 'code' }]
    };
  }

  /**
   * Convert mdast link node to ADF text with link mark
   */
  private convertMdastLink(node: any): ADFNode {
    // Convert children and wrap in paragraph if needed
    const content = this.convertMdastNodesToADF(node.children);
    
    // If content is text nodes, add link marks
    const processedContent = content.map(child => {
      if (child.type === 'text') {
        const marks = child.marks || [];
        return {
          ...child,
          marks: [...marks, { type: 'link', attrs: { href: node.url } }]
        };
      }
      return child;
    });

    // Return wrapped in paragraph if we have multiple nodes
    if (processedContent.length === 1 && processedContent[0].type === 'text') {
      return processedContent[0];
    }
    
    return {
      type: 'paragraph',
      content: processedContent
    };
  }

  /**
   * Convert mdast image node to ADF media/mediaSingle node
   */
  private convertMdastImage(node: any): ADFNode | null {
    if (!node.url) {
      return null;
    }

    // Check if this is an ADF media placeholder (adf:media: or media:)
    const adfMediaMatch = node.url.match(/^(?:adf:)?media:(.+)$/);
    if (!adfMediaMatch) {
      // Regular image - not a media placeholder
      // For now, we'll treat regular images as unsupported and return null
      // In the future, this could be expanded to convert regular images to media nodes
      return null;
    }

    const mediaId = adfMediaMatch[1];
    
    // Handle empty media ID
    if (!mediaId) {
      return null;
    }
    
    // Get metadata from the node
    const metadata = getNodeMetadata(node);
    
    // Find media and mediaSingle metadata
    let mediaAttrs: Record<string, any> = { id: mediaId, type: 'file' };
    let mediaSingleAttrs: Record<string, any> = {};
    
    for (const meta of metadata) {
      if (meta.nodeType === 'media' && meta.attrs) {
        mediaAttrs = { ...mediaAttrs, ...meta.attrs };
      } else if (meta.nodeType === 'mediaSingle' && meta.attrs) {
        mediaSingleAttrs = { ...meta.attrs };
      }
    }

    // Add alt text only if present, not null/undefined, and not empty string
    // Empty string from markdown parser means no alt text was provided
    if (node.alt !== undefined && node.alt !== null && node.alt !== '') {
      mediaAttrs.alt = node.alt;
    }

    // Create media node
    const mediaNode: ADFNode = {
      type: 'media',
      attrs: mediaAttrs
    };

    // Add default collection if missing
    if (!mediaAttrs.collection) {
      mediaAttrs.collection = '';
    }

    // Always wrap media in mediaSingle for block-level images
    return {
      type: 'mediaSingle',
      attrs: {
        layout: 'center',
        ...mediaSingleAttrs
      },
      content: [mediaNode]
    };
  }

  /**
   * Convert inline mdast nodes to ADF text nodes with marks
   */
  private convertMdastInlineNodes(nodes: any[]): ADFNode[] {
    const adfNodes: ADFNode[] = [];
    
    
    // Convert all nodes normally
    for (const node of nodes) {
      const result = this.convertMdastInlineNode(node);
      if (Array.isArray(result)) {
        adfNodes.push(...result);
      } else if (result) {
        adfNodes.push(result);
      }
    }
    
    return adfNodes;
  }

  /**
   * Convert single inline mdast node to ADF
   */
  private convertMdastInlineNode(node: any): ADFNode | ADFNode[] | null {
    switch (node.type) {
      case 'text':
        // Check if this text node has metadata with marks (from span-style comments)
        if (node.data?.adfMetadata && Array.isArray(node.data.adfMetadata)) {
          const metadata = node.data.adfMetadata[0];
          if (metadata && metadata.marks && Array.isArray(metadata.marks)) {
            // Create text node with the marks from metadata
            return {
              type: 'text' as const,
              text: node.value,
              marks: metadata.marks
            };
          }
        }
        
        // Process text node for social elements and special syntax
        return this.processTextNodeForSocialElements(node.value);
      
      case 'strong':
        return this.wrapWithMark(node.children, 'strong');
      
      case 'emphasis':
        return this.wrapWithMark(node.children, 'em');
      
      case 'inlineCode':
        return { type: 'text', text: node.value, marks: [{ type: 'code' }] };
      
      case 'delete':
        return this.wrapWithMark(node.children, 'strike');
      
      case 'link':
        // Check if this is an inline card (card: URL)
        if (node.url.startsWith('card:')) {
          return {
            type: 'inlineCard',
            attrs: {
              url: node.url.substring(5) // Remove 'card:' prefix
            }
          };
        }
        return this.wrapWithMark(node.children, 'link', { href: node.url, ...(node.title && { title: node.title }) });
      
      case 'break':
        return { type: 'hardBreak' };
      
      case 'image':
        return this.convertMdastImage(node);
      
      case 'html':
        // Skip ADF metadata comments - they should have been processed already
        if (node.value && isAdfMetadataComment(node.value)) {
          return null;
        }
        // Skip ADF processing directives (like inlineCard, blockCard)
        if (node.value && this.isAdfProcessingDirective(node.value)) {
          return null;
        }
        // For other HTML nodes, preserve as text if option is set
        if (this.options.preserveUnknownNodes) {
          return { type: 'text', text: `[HTML: ${node.value}]` };
        } else {
          return null;
        }
      
      default:
        // Unknown inline node, treat as text
        return { type: 'text', text: node.value || `[${node.type}]` };
    }
  }

  /**
   * Wrap mdast children with an ADF mark
   */
  private wrapWithMark(children: any[], markType: string, attrs?: any): ADFNode[] {
    const childNodes = this.convertMdastInlineNodes(children);
    const mark = attrs ? { type: markType, attrs } : { type: markType };
    
    // Apply the mark to text nodes and social elements that can have marks
    const markableNodeTypes = ['text', 'mention', 'emoji', 'status', 'date', 'inlineCard'];
    
    return childNodes.map(node => {
      if (markableNodeTypes.includes(node.type)) {
        const marks = node.marks ? [...node.marks] : [];
        marks.push(mark);
        return {
          ...node,
          marks
        };
      }
      return node;
    });
  }

  /**
   * Convert ADF nodes back to mdast
   */
  private convertAdfNodesToMdast(nodes: ADFNode[]): any[] {
    const result: any[] = [];
    
    for (const node of nodes) {
      const converted = this.convertAdfNodeToMdast(node);
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted);
        } else {
          result.push(converted);
        }
      }
    }
    
    return result;
  }

  /**
   * Convert single ADF node back to mdast
   */
  private convertAdfNodeToMdast(node: ADFNode): any | any[] {
    let mdastNode: any;

    switch (node.type) {
      case 'heading':
        mdastNode = {
          type: 'heading',
          depth: (node.attrs as any)?.level || 1,
          children: this.convertAdfInlineToMdast(node.content || [])
        };
        break;
      
      case 'paragraph':
        mdastNode = {
          type: 'paragraph',
          children: this.convertAdfInlineToMdast(node.content || [])
        };
        break;
      
      case 'panel':
        mdastNode = {
          type: 'adfFence',
          nodeType: 'panel',
          attributes: { type: (node.attrs as any)?.panelType || 'info', ...node.attrs },
          value: this.extractContentAsText(node.content || [])
        };
        break;
      
      case 'media':
        const mediaAttrs = node.attrs as any;
        const altText = mediaAttrs?.alt || 'Media';
        mdastNode = {
          type: 'image',
          url: `adf:media:${mediaAttrs?.id || 'unknown'}`,
          alt: altText,
          title: null
        };
        
        // Generate media metadata comment manually (including all attributes except alt)
        const mediaMetadataAttrs: Record<string, any> = {};
        if (mediaAttrs?.id) mediaMetadataAttrs.id = mediaAttrs.id;
        if (mediaAttrs?.type) mediaMetadataAttrs.type = mediaAttrs.type;
        if (mediaAttrs?.collection) mediaMetadataAttrs.collection = mediaAttrs.collection;
        if (mediaAttrs?.width) mediaMetadataAttrs.width = mediaAttrs.width;
        if (mediaAttrs?.height) mediaMetadataAttrs.height = mediaAttrs.height;
        // Add any other custom attributes (excluding alt)
        Object.keys(mediaAttrs || {}).forEach(key => {
          if (!['id', 'type', 'collection', 'width', 'height', 'alt'].includes(key)) {
            mediaMetadataAttrs[key] = mediaAttrs[key];
          }
        });
        
        if (Object.keys(mediaMetadataAttrs).length > 0) {
          const metadataString = Object.entries(mediaMetadataAttrs)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
          const mediaComment = `<!-- adf:media ${metadataString} -->`;
          
          // Return array with metadata comment followed by the image
          return [
            { type: 'html', value: mediaComment },
            mdastNode
          ];
        }
        
        break;
      
      case 'mediaSingle':
        // Convert mediaSingle by converting its inner media content
        const mediaContent = node.content ? this.convertAdfNodesToMdast(node.content) : [];
        
        // Generate mediaSingle metadata comment
        const mediaSingleComment = generateMetadataComment(node.type, node.attrs);
        
        if (mediaContent.length > 0) {
          // If we have media content (which may be [comment, image] array), handle accordingly
          const result = [];
          
          // Add mediaSingle metadata comment first if it exists
          if (mediaSingleComment) {
            result.push({ type: 'html', value: mediaSingleComment });
          }
          
          // Add all media content (comments and images)
          result.push(...mediaContent);
          
          return result;
        } else {
          // Fallback case
          mdastNode = {
            type: 'image',
            url: 'adf:media:unknown',
            alt: 'Media',
            title: null
          };
        }
        break;
      
      default:
        // Return a generic paragraph for unknown nodes
        mdastNode = {
          type: 'paragraph',
          children: [{ type: 'text', value: `[${node.type}]` }]
        };
        break;
    }

    // Generate metadata comment if the node has custom attributes
    const metadataComment = generateMetadataComment(node.type, node.attrs);
    
    if (metadataComment) {
      // Return array with metadata comment followed by the node
      return [
        { type: 'html', value: metadataComment },
        mdastNode
      ];
    }

    return mdastNode;
  }

  /**
   * Convert ADF inline content to mdast
   */
  private convertAdfInlineToMdast(content: ADFNode[]): any[] {
    return content.map(node => {
      if (node.type === 'text') {
        let result: any = { type: 'text', value: node.text };
        
        // Apply marks
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'strong':
                result = { type: 'strong', children: [result] };
                break;
              case 'em':
                result = { type: 'emphasis', children: [result] };
                break;
              case 'code':
                result = { type: 'inlineCode', value: node.text };
                break;
              case 'link':
                result = { 
                  type: 'link', 
                  url: (mark.attrs as any)?.href,
                  children: [result] 
                };
                break;
            }
          }
        }
        
        return result;
      }
      
      return { type: 'text', value: `[${node.type}]` };
    });
  }

  /**
   * Extract content as plain text
   */
  private extractContentAsText(content: ADFNode[]): string {
    return content
      .map(node => {
        if (node.type === 'text') {
          return node.text;
        }
        if (node.content) {
          return this.extractContentAsText(node.content);
        }
        return '';
      })
      .join('');
  }

  /**
   * Filter attributes excluding specified keys
   */
  private filterAttributes(attrs: Record<string, any>, excludeKeys: string[]): Record<string, any> {
    const filtered: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(attrs)) {
      if (!excludeKeys.includes(key)) {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  /**
   * Parse block content (panel, expand content) as full markdown with social elements
   */
  private parseBlockContentWithSocialElements(content: string): ADFNode[] {
    if (!content || !content.trim()) return [];

    // We need to parse this as full markdown, not just inline content
    // For now, let's split by double newlines for paragraph breaks and handle lists
    const blocks = this.splitIntoBlocks(content);
    const adfNodes: ADFNode[] = [];

    for (const block of blocks) {
      if (block.trim()) {
        const blockNode = this.parseBlockContent(block.trim());
        if (blockNode) {
          adfNodes.push(blockNode);
        }
      }
    }

    return adfNodes.length > 0 ? adfNodes : [{
      type: 'paragraph',
      content: this.parseInlineContentWithSocialElements(content)
    }];
  }

  /**
   * Split content into markdown blocks (paragraphs, lists, ADF fence blocks, etc.)
   */
  private splitIntoBlocks(content: string): string[] {
    // Split by double newlines for paragraph breaks
    // But keep list items and ADF fence blocks together
    const lines = content.split('\n');
    const blocks: string[] = [];
    let currentBlock = '';
    let inList = false;
    let inADFFence = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isListItem = /^\s*[-*+]\s/.test(line);
      const isEmptyLine = line.trim() === '';
      const isADFFenceStart = /^~~~(\w+)(?:\s+.*)?$/.test(line.trim());
      const isADFFenceEnd = line.trim() === '~~~' && inADFFence;

      if (isADFFenceStart && !inADFFence) {
        // Start of ADF fence block
        if (currentBlock.trim()) {
          // End current block and start ADF fence
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        inADFFence = true;
        currentBlock += (currentBlock ? '\n' : '') + line;
      } else if (isADFFenceEnd) {
        // End of ADF fence block
        currentBlock += '\n' + line;
        blocks.push(currentBlock.trim());
        currentBlock = '';
        inADFFence = false;
      } else if (inADFFence) {
        // Inside ADF fence block - keep everything together
        currentBlock += '\n' + line;
      } else if (isListItem) {
        if (!inList && currentBlock.trim()) {
          // End current block and start list
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        inList = true;
        currentBlock += (currentBlock ? '\n' : '') + line;
      } else if (isEmptyLine) {
        if (inList) {
          // End list block
          blocks.push(currentBlock.trim());
          currentBlock = '';
          inList = false;
        } else if (currentBlock.trim()) {
          // End paragraph block
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
      } else {
        if (inList) {
          // End list and start new paragraph
          blocks.push(currentBlock.trim());
          currentBlock = line;
          inList = false;
        } else {
          currentBlock += (currentBlock ? '\n' : '') + line;
        }
      }
    }

    // Add final block
    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }

    return blocks;
  }

  /**
   * Parse a single block of content (ADF fence blocks, horizontal rules, headings, code blocks, blockquotes, lists, tables, paragraphs)
   */
  private parseBlockContent(blockContent: string): ADFNode | null {
    if (!blockContent.trim()) return null;

    const lines = blockContent.split('\n');
    const trimmed = blockContent.trim();
    
    // Check for different block types in priority order
    
    // 1. ADF fence blocks (~~~panel, ~~~expand, ~~~mediaSingle, ~~~mediaGroup)
    if (/^~~~(\w+)(?:\s+.*)?$/m.test(trimmed) && trimmed.includes('\n~~~')) {
      // This is a complete ADF fence block - tokenize it properly
      try {
        const tokenizer = new MarkdownTokenizer();
        const tokens = tokenizer.tokenize(blockContent);
        if (tokens.length > 0) {
          const node = this.convertTokenToNode(tokens[0]);
          if (node) {
            return node;
          }
        }
      } catch (error) {
        // If tokenization fails, fall through to default parsing
        console.warn('❌ ADF fence block tokenization failed:', error);
      }
    }
    
    // 2. Horizontal rule
    if (/^\s*[-*_]\s*[-*_]\s*[-*_]\s*$/.test(trimmed) || /^\s*---+\s*$/.test(trimmed)) {
      return { type: 'rule' };
    }
    
    // 3. Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      return {
        type: 'heading',
        attrs: { level: Math.min(Math.max(level, 1), 6) },
        content: this.parseInlineContentWithSocialElements(content)
      };
    }
    
    // 4. Code block (fenced)
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      const codeLines = lines.slice(1, -1); // Remove fence lines
      const firstLine = lines[0];
      const languageMatch = firstLine.match(/^```(\w+)?/);
      const language = languageMatch?.[1];
      
      const attrs: any = {};
      if (language) attrs.language = language;
      
      return {
        type: 'codeBlock',
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        content: [{ type: 'text', text: codeLines.join('\n') }]
      };
    }
    
    // 5. Blockquote
    const isBlockquote = lines.every(line => 
      line.trim() === '' || line.match(/^\s*>\s?/)
    );
    if (isBlockquote && lines.some(line => line.match(/^\s*>\s?/))) {
      const quotedContent = lines
        .map(line => line.replace(/^\s*>\s?/, ''))
        .join('\n')
        .trim();
      
      return {
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: this.parseInlineContentWithSocialElements(quotedContent)
        }]
      };
    }
    
    // 6. Ordered list
    const isOrderedList = lines.some(line => /^\s*\d+\.\s/.test(line));
    if (isOrderedList) {
      const listItems: ADFNode[] = [];
      
      for (const line of lines) {
        const listMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (listMatch) {
          const itemContent = this.parseInlineContentWithSocialElements(listMatch[1]);
          listItems.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: itemContent
            }]
          });
        }
      }

      return {
        type: 'orderedList',
        content: listItems
      };
    }
    
    // 7. Bullet list
    const isBulletList = lines.some(line => /^\s*[-*+]\s/.test(line));
    if (isBulletList) {
      const listItems: ADFNode[] = [];
      
      for (const line of lines) {
        const listMatch = line.match(/^\s*[-*+]\s+(.+)$/);
        if (listMatch) {
          const itemContent = this.parseInlineContentWithSocialElements(listMatch[1]);
          listItems.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: itemContent
            }]
          });
        }
      }

      return {
        type: 'bulletList',
        content: listItems
      };
    }
    
    // 8. Table
    const isTableBlock = lines.some(line => /^\s*\|.*\|\s*$/.test(line));
    if (isTableBlock) {
      return this.parseTableFromLines(lines);
    }
    
    // 9. Default: paragraph
    return {
      type: 'paragraph',
      content: this.parseInlineContentWithSocialElements(blockContent)
    };
  }

  /**
   * Parse table from lines of markdown
   */
  private parseTableFromLines(lines: string[]): ADFNode {
    const tableRows: ADFNode[] = [];
    let headerProcessed = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip separator lines (e.g., |---|---|
      if (/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|$/.test(trimmedLine)) {
        headerProcessed = true;
        continue;
      }

      // Process table rows
      if (/^\|.*\|$/.test(trimmedLine)) {
        const cells = trimmedLine
          .slice(1, -1) // Remove leading and trailing |
          .split('|')
          .map(cell => cell.trim());

        const isHeader = !headerProcessed;
        const cellNodes: ADFNode[] = cells.map(cellContent => ({
          type: isHeader ? 'tableHeader' : 'tableCell',
          content: this.parseInlineContentWithSocialElements(cellContent)
        }));

        tableRows.push({
          type: 'tableRow',
          content: cellNodes
        });
      }
    }

    return {
      type: 'table',
      attrs: {
        isNumberColumnEnabled: false,
        layout: 'default'
      },
      content: tableRows
    };
  }

  /**
   * Post-process ADF nodes to handle nested ADF fence blocks
   * Smart nesting: Only nest blocks when there's evidence they should be nested
   */
  private postProcessNestedAdfFenceBlocks(content: ADFNode[]): ADFNode[] {
    const result: ADFNode[] = [];
    
    for (let i = 0; i < content.length; i++) {
      const node = content[i];
      
      // Check if this is an expand or panel block that should collect subsequent ADF blocks
      // For panels, only collect if there are mixed content types (not consecutive same-level panels)
      if ((node.type === 'expand' || node.type === 'panel') && i < content.length - 1) {
        // Look ahead for subsequent content that should be nested
        const nestedNodes: ADFNode[] = [];
        let j = i + 1;
        let hasMixedContent = false;
        
        // Check for consecutive same-type blocks that should remain separate
        if (node.type === 'panel' || node.type === 'expand') {
          // Look ahead to see if we have consecutive blocks of the same type
          // These should NOT be nested
          if (content[j] && content[j].type === node.type) {
            // Consecutive panels or expands - keep separate
            result.push(node);
            continue;
          }
          
          // For panels specifically, also check for multiple consecutive panels
          if (node.type === 'panel') {
            let hasOnlyPanels = true;
            for (let k = j; k < content.length && k < j + 3; k++) {
              if (content[k].type !== 'panel') {
                hasOnlyPanels = false;
                break;
              }
            }
            
            // If all subsequent nodes are panels, keep them separate
            if (hasOnlyPanels && content.length > j) {
              result.push(node);
              continue;
            }
          }
        }
        
        while (j < content.length) {
          const nextNode = content[j];
          
          // Collect any content that should be nested
          if (this.isAdfFenceBlockType(nextNode.type) || nextNode.type === 'paragraph') {
            nestedNodes.push(nextNode);
            if (nextNode.type === 'paragraph') {
              hasMixedContent = true;
            }
            j++;
          } else {
            // Stop if we hit other content that ends the nesting
            break;
          }
        }
        
        if (nestedNodes.length > 0) {
          // Create a new node with the nested content
          const enhancedNode = {
            ...node,
            content: [
              ...(node.content || []),
              ...nestedNodes
            ]
          };
          
          result.push(enhancedNode);
          i = j - 1; // Skip the nodes we've nested
        } else {
          result.push(node);
        }
      } else {
        result.push(node);
      }
    }
    
    return result;
  }

  /**
   * Check if a node type is an ADF fence block type that can be nested
   */
  private isAdfFenceBlockType(nodeType: string): boolean {
    return ['panel', 'expand', 'nestedExpand', 'mediaSingle', 'mediaGroup'].includes(nodeType);
  }
}