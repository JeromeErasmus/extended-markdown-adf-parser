/**
 * @file Parser.ts 
 * @description Main unified Parser class
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { remarkAdf } from './remark/remark-adf.js';
import type { ADFDocument, ADFNode, ConversionOptions, ValidationResult } from '../types/index.js';
import type { ConversionContext } from './types.js';
import { AdfValidator } from '../validators/AdfValidator.js';
import { MarkdownValidator } from '../validators/MarkdownValidator.js';
import { ParserError, ValidationError } from '../errors/index.js';
import { ConverterRegistry } from './ConverterRegistry.js';
import { MarkdownToAdfEngine } from './engines/MarkdownToAdfEngine.js';
import { AdfToMarkdownEngine } from './engines/AdfToMarkdownEngine.js';
import { ErrorRecoveryManager } from '../errors/ErrorRecovery.js';
import { getSafeJSONLength } from '../utils/json-utils.js';

// Import node converters for legacy support
import { ParagraphConverter } from './adf-to-markdown/nodes/ParagraphConverter.js';
import { TextConverter } from './adf-to-markdown/nodes/TextConverter.js';
import { HeadingConverter } from './adf-to-markdown/nodes/HeadingConverter.js';
import { PanelConverter } from './adf-to-markdown/nodes/PanelConverter.js';
import { CodeBlockConverter } from './adf-to-markdown/nodes/CodeBlockConverter.js';
import { BulletListConverter } from './adf-to-markdown/nodes/BulletListConverter.js';
import { OrderedListConverter } from './adf-to-markdown/nodes/OrderedListConverter.js';
import { ListItemConverter } from './adf-to-markdown/nodes/ListItemConverter.js';
import { MediaConverter } from './adf-to-markdown/nodes/MediaConverter.js';
import { MediaSingleConverter } from './adf-to-markdown/nodes/MediaSingleConverter.js';
import { TableConverter } from './adf-to-markdown/nodes/TableConverter.js';
import { TableRowConverter } from './adf-to-markdown/nodes/TableRowConverter.js';
import { TableHeaderConverter } from './adf-to-markdown/nodes/TableHeaderConverter.js';
import { TableCellConverter } from './adf-to-markdown/nodes/TableCellConverter.js';
import { ExpandConverter, NestedExpandConverter } from './adf-to-markdown/nodes/ExpandConverter.js';
import { BlockquoteConverter } from './adf-to-markdown/nodes/BlockquoteConverter.js';
import { RuleConverter } from './adf-to-markdown/nodes/RuleConverter.js';
import { HardBreakConverter } from './adf-to-markdown/nodes/HardBreakConverter.js';
import { MentionConverter } from './adf-to-markdown/nodes/MentionConverter.js';
import { DateConverter } from './adf-to-markdown/nodes/DateConverter.js';
import { EmojiConverter } from './adf-to-markdown/nodes/EmojiConverter.js';
import { StatusConverter } from './adf-to-markdown/nodes/StatusConverter.js';
import { InlineCardConverter } from './adf-to-markdown/nodes/InlineCardConverter.js';
import { MediaGroupConverter } from './adf-to-markdown/nodes/MediaGroupConverter.js';
import { DocConverter } from './adf-to-markdown/nodes/DocConverter.js';

// Import mark converters for legacy support
import { StrongConverter } from './adf-to-markdown/marks/StrongConverter.js';
import { EmConverter } from './adf-to-markdown/marks/EmConverter.js';
import { CodeConverter } from './adf-to-markdown/marks/CodeConverter.js';
import { LinkConverter } from './adf-to-markdown/marks/LinkConverter.js';
import { StrikeConverter } from './adf-to-markdown/marks/StrikeConverter.js';
import { UnderlineConverter } from './adf-to-markdown/marks/UnderlineConverter.js';
import { TextColorConverter } from './adf-to-markdown/marks/TextColorConverter.js';
import { BackgroundColorConverter } from './adf-to-markdown/marks/BackgroundColorConverter.js';
import { SubsupConverter } from './adf-to-markdown/marks/SubsupConverter.js';

/**
 * Main parser class - uses unified conversion engines
 */
export class Parser {
  private mdToAdfEngine: MarkdownToAdfEngine;
  private adfToMdEngine: AdfToMarkdownEngine;
  private options: ConversionOptions;
  private errorRecovery: ErrorRecoveryManager;
  
  // Legacy support - kept for backward compatibility
  private remarkProcessor;
  private registry: ConverterRegistry;
  
  constructor(options?: ConversionOptions) {
    try {
      this.options = options || {};
      
      // Initialize core conversion engines
      this.mdToAdfEngine = new MarkdownToAdfEngine(this.options);
      this.adfToMdEngine = new AdfToMarkdownEngine(this.options);
      
      // Initialize error recovery manager
      this.errorRecovery = new ErrorRecoveryManager({
        maxRetries: options?.maxRetries || 3,
        retryDelay: options?.retryDelay || 100,
        fallbackStrategy: options?.fallbackStrategy || 'best-effort',
        enableLogging: options?.enableLogging || false,
        onError: options?.onError,
        onRecovery: options?.onRecovery
      });
      
      // Legacy support - initialize old components for backward compatibility
      this.remarkProcessor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkGfm)
        .use(remarkAdf, {
          strict: options?.strict || false
        })
        .use(remarkStringify);
        
      this.registry = new ConverterRegistry();
      this.registerConverters();
    } catch (error) {
      throw new ParserError('Failed to initialize Parser', 'INIT_ERROR');
    }
  }
  
  /**
   * Convert ADF to Extended Markdown
   * Uses the core AdfToMarkdownEngine
   */
  adfToMarkdown(adf: ADFDocument, options?: ConversionOptions): string {
    // If options are provided, use a temporary engine with merged options
    if (options && Object.keys(options).length > 0) {
      const mergedOptions = { ...this.options, ...options };
      const tempEngine = new AdfToMarkdownEngine(mergedOptions);
      return tempEngine.convert(adf);
    }
    return this.adfToMdEngine.convert(adf);
  }

  /**
   * Convert ADF to Extended Markdown with error recovery
   */
  async adfToMarkdownWithRecovery(adf: ADFDocument, options?: ConversionOptions): Promise<string> {
    const result = await this.errorRecovery.executeWithRecovery(
      () => this.adfToMarkdown(adf, options),
      {
        operation: 'adfToMarkdown',
        input: adf,
        nodeType: adf.type
      }
    );

    if (!result.success) {
      throw result.error || new Error('ADF to Markdown conversion failed');
    }

    return result.data as string;
  }
  
  /**
   * Convert Extended Markdown to ADF
   * Uses the core MarkdownToAdfEngine
   */
  markdownToAdf(markdown: string, options?: ConversionOptions): ADFDocument {
    // If options are provided, use a temporary engine with merged options
    if (options && Object.keys(options).length > 0) {
      const mergedOptions = { ...this.options, ...options };
      const tempEngine = new MarkdownToAdfEngine(mergedOptions);
      return tempEngine.convert(markdown);
    }
    return this.mdToAdfEngine.convert(markdown);
  }

  /**
   * Convert Extended Markdown to ADF with error recovery
   */
  async markdownToAdfWithRecovery(markdown: string, options?: ConversionOptions): Promise<ADFDocument> {
    const result = await this.errorRecovery.executeWithRecovery(
      () => this.markdownToAdf(markdown, options),
      {
        operation: 'markdownToAdf',
        input: markdown
      }
    );

    if (!result.success) {
      throw result.error || new Error('Markdown to ADF conversion failed');
    }

    return result.data as ADFDocument;
  }

  /**
   * Convert Extended Markdown to ADF using async engine
   */
  async markdownToAdfAsync(markdown: string, options?: ConversionOptions): Promise<ADFDocument> {
    return await this.mdToAdfEngine.convertAsync(markdown);
  }

  /**
   * Convert Extended Markdown to ADF using async engine with error recovery
   */
  async markdownToAdfAsyncWithRecovery(markdown: string, options?: ConversionOptions): Promise<ADFDocument> {
    const result = await this.errorRecovery.executeWithRecovery(
      async () => this.markdownToAdfAsync(markdown, options),
      {
        operation: 'markdownToAdfAsync',
        input: markdown
      }
    );

    if (!result.success) {
      throw result.error || new Error('Async Markdown to ADF conversion failed');
    }

    return result.data as ADFDocument;
  }

  /**
   * Validate markdown using the engine
   */
  async validateMarkdownAsync(markdown: string): Promise<ValidationResult & { warnings?: string[] }> {
    const result = await this.mdToAdfEngine.validate(markdown);
    return {
      valid: result.valid,
      errors: result.errors.map(error => ({ message: error })),
      warnings: result.warnings
    };
  }

  /**
   * Get parsing statistics using the engine
   */
  async getStats(markdown: string): Promise<{
    nodeCount: number;
    adfBlockCount?: number;
    hasGfmFeatures?: boolean;
    hasFrontmatter?: boolean;
    hasAdfExtensions?: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    processingTime?: number;
  }> {
    return await this.mdToAdfEngine.getStats(markdown);
  }

  /**
   * Convert ADF to markdown (alias for adfToMarkdown for backward compatibility)
   */
  stringify(adf: ADFDocument, options?: ConversionOptions): string {
    return this.adfToMarkdown(adf, options);
  }

  /**
   * Async version of stringify
   */
  async stringifyAsync(adf: ADFDocument, options?: ConversionOptions): Promise<string> {
    return this.adfToMarkdownWithRecovery(adf, options);
  }
  
  /**
   * Validate ADF structure
   */
  validateAdf(adf: unknown): ValidationResult {
    return new AdfValidator().validate(adf);
  }
  
  /**
   * Validate Extended Markdown
   */
  validateMarkdown(markdown: string): ValidationResult {
    return new MarkdownValidator().validate(markdown);
  }


  /**
   * Get error recovery manager instance
   */
  getErrorRecovery(): ErrorRecoveryManager {
    return this.errorRecovery;
  }

  
  // Private implementation methods
  private registerConverters(): void {
    // Register node converters
    this.registry.registerNodes([
      new ParagraphConverter(),
      new TextConverter(),
      new HeadingConverter(),
      new PanelConverter(),
      new CodeBlockConverter(),
      new BulletListConverter(),
      new OrderedListConverter(),
      new ListItemConverter(),
      new MediaConverter(),
      new MediaSingleConverter(),
      new TableConverter(),
      new TableRowConverter(),
      new TableHeaderConverter(),
      new TableCellConverter(),
      new ExpandConverter(),
      new NestedExpandConverter(),
      new BlockquoteConverter(),
      new RuleConverter(),
      new HardBreakConverter(),
      new MentionConverter(),
      new DateConverter(),
      new EmojiConverter(),
      new StatusConverter(),
      new InlineCardConverter(),
      new MediaGroupConverter(),
      new DocConverter()
    ]);
    
    // Register mark converters
    this.registry.registerMarks([
      new StrongConverter(),
      new EmConverter(),
      new CodeConverter(),
      new LinkConverter(),
      new StrikeConverter(),
      new UnderlineConverter(),
      new TextColorConverter(),
      new BackgroundColorConverter(),
      new SubsupConverter()
    ]);
  }
  
  // Legacy method - now handled by AdfToMarkdownEngine
  private convertAdfToMarkdown(adf: ADFDocument): string {
    return this.adfToMdEngine.convert(adf);
  }
  
  // Legacy methods - now handled by MarkdownToAdfEngine
  private convertMdastToAdf(mdast: any): ADFDocument {
    // Use the engine for conversion
    return this.mdToAdfEngine.convert(mdast);
  }
  
  private fallbackConversion(markdown: string): ADFDocument {
    // Use the engine's fallback logic
    return this.mdToAdfEngine.convert(markdown);
  }

  private countNodes(content: ADFNode[]): number {
    let count = 0;
    
    for (const node of content) {
      count++;
      if (node.content && Array.isArray(node.content)) {
        count += this.countNodes(node.content);
      }
    }
    
    return count;
  }

  // Legacy methods - now handled by engines
  private postProcessAdfFenceBlocks(tree: any): any {
    // This logic is now inside MarkdownToAdfEngine
    return tree;
  }

  private parseAdfLanguageString(lang: string, meta: string): Record<string, any> {
    // This logic is now inside MarkdownToAdfEngine
    return {};
  }
}