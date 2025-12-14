/**
 * @file types.ts
 * @description Type definitions for Markdown to ADF conversion
 */

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface ADFMetadata {
  nodeType: string;
  attrs?: Record<string, any>;
  markType?: string;
  marks?: any[]; // Array of marks for text formatting
}

export interface Token {
  type: TokenType;
  content: string;
  metadata?: ADFMetadata;
  children?: Token[];
  position: Position;
  raw: string;
}

export type TokenType = 
  | 'document'
  | 'frontmatter' 
  | 'heading'
  | 'paragraph'
  | 'blockquote'
  | 'codeBlock'
  | 'list'
  | 'listItem'
  | 'table'
  | 'tableRow'
  | 'tableHeader'
  | 'tableCell'
  | 'panel'
  | 'expand'
  | 'mediaSingle'
  | 'mediaGroup'
  | 'rule'
  | 'text'
  | 'hardBreak'
  | 'inlineCode'
  | 'link'
  | 'image'
  | 'strong'
  | 'emphasis'
  | 'strikethrough'
  | 'underline'
  | 'comment'
  | 'unknown';

export interface ListToken extends Token {
  type: 'list';
  ordered: boolean;
  start?: number;
  tight: boolean;
}

export interface TableToken extends Token {
  type: 'table';
  columnAlignments: ('left' | 'center' | 'right' | null)[];
}

export interface FenceToken extends Token {
  type: 'panel' | 'expand' | 'mediaSingle' | 'mediaGroup' | 'codeBlock';
  fenceType: 'backtick' | 'tilde';
  language?: string;
  attributes?: Record<string, string>;
}

export interface ParsingContext {
  inList: boolean;
  inTable: boolean;
  inBlockquote: boolean;
  inFenceBlock: boolean;
  listDepth: number;
  currentLine: number;
  currentColumn: number;
  currentOffset: number;
}

export interface TokenizeOptions {
  preserveWhitespace?: boolean;
  strict?: boolean;
  maxDepth?: number;
}