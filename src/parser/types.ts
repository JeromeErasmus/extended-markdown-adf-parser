/**
 * @file Converter interfaces and types
 */

import type { ADFNode } from '../types';
import type { ConverterRegistry } from './ConverterRegistry';

export interface ConversionContext {
  convertChildren: (nodes: ADFNode[]) => string;
  depth: number;
  parent?: ADFNode;
  options: ConversionOptions;
  /** List marker (e.g. '- ' or '5. ') continuation lines must indent to match. */
  marker?: string;
}

export interface ConversionOptions {
  strict?: boolean;
  preserveWhitespace?: boolean;
  validateInput?: boolean;
  registry?: ConverterRegistry;
}

export interface NodeConverter {
  nodeType: string;
  toMarkdown(node: ADFNode, context: ConversionContext): string;
  fromMarkdown?(mdastNode: any, context: ConversionContext): ADFNode;
}

export interface MarkConverter {
  markType: string;
  toMarkdown(text: string, mark: any, context: ConversionContext): string;
  fromMarkdown?(text: string, context: ConversionContext): { text: string; marks: any[] };
}