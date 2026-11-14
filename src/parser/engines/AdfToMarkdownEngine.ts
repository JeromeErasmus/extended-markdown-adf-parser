/**
 * @file AdfToMarkdownEngine.ts
 * @description Core engine for converting ADF to Markdown - uses ConverterRegistry
 */

import type { ADFDocument, ADFNode, ConversionOptions } from '../../types/index.js';
import type { ConversionContext } from '../types.js';
import { ConverterRegistry } from '../ConverterRegistry.js';
import { AdfValidator } from '../../validators/AdfValidator.js';

// Import node converters
import { ParagraphConverter } from '../adf-to-markdown/nodes/ParagraphConverter.js';
import { TextConverter } from '../adf-to-markdown/nodes/TextConverter.js';
import { HeadingConverter } from '../adf-to-markdown/nodes/HeadingConverter.js';
import { PanelConverter } from '../adf-to-markdown/nodes/PanelConverter.js';
import { CodeBlockConverter } from '../adf-to-markdown/nodes/CodeBlockConverter.js';
import { BulletListConverter } from '../adf-to-markdown/nodes/BulletListConverter.js';
import { OrderedListConverter } from '../adf-to-markdown/nodes/OrderedListConverter.js';
import { ListItemConverter } from '../adf-to-markdown/nodes/ListItemConverter.js';
import { TaskListConverter } from '../adf-to-markdown/nodes/TaskListConverter.js';
import { TaskItemConverter } from '../adf-to-markdown/nodes/TaskItemConverter.js';
import { MediaConverter } from '../adf-to-markdown/nodes/MediaConverter.js';
import { MediaSingleConverter } from '../adf-to-markdown/nodes/MediaSingleConverter.js';
import { TableConverter } from '../adf-to-markdown/nodes/TableConverter.js';
import { TableRowConverter } from '../adf-to-markdown/nodes/TableRowConverter.js';
import { TableHeaderConverter } from '../adf-to-markdown/nodes/TableHeaderConverter.js';
import { TableCellConverter } from '../adf-to-markdown/nodes/TableCellConverter.js';
import { ExpandConverter, NestedExpandConverter } from '../adf-to-markdown/nodes/ExpandConverter.js';
import { BlockquoteConverter } from '../adf-to-markdown/nodes/BlockquoteConverter.js';
import { RuleConverter } from '../adf-to-markdown/nodes/RuleConverter.js';
import { HardBreakConverter } from '../adf-to-markdown/nodes/HardBreakConverter.js';
import { MentionConverter } from '../adf-to-markdown/nodes/MentionConverter.js';
import { DateConverter } from '../adf-to-markdown/nodes/DateConverter.js';
import { EmojiConverter } from '../adf-to-markdown/nodes/EmojiConverter.js';
import { StatusConverter } from '../adf-to-markdown/nodes/StatusConverter.js';
import { InlineCardConverter } from '../adf-to-markdown/nodes/InlineCardConverter.js';
import { MediaGroupConverter } from '../adf-to-markdown/nodes/MediaGroupConverter.js';
import { DocConverter } from '../adf-to-markdown/nodes/DocConverter.js';

// Import mark converters
import { StrongConverter } from '../adf-to-markdown/marks/StrongConverter.js';
import { EmConverter } from '../adf-to-markdown/marks/EmConverter.js';
import { CodeConverter } from '../adf-to-markdown/marks/CodeConverter.js';
import { LinkConverter } from '../adf-to-markdown/marks/LinkConverter.js';
import { StrikeConverter } from '../adf-to-markdown/marks/StrikeConverter.js';
import { UnderlineConverter } from '../adf-to-markdown/marks/UnderlineConverter.js';
import { TextColorConverter } from '../adf-to-markdown/marks/TextColorConverter.js';
import { BackgroundColorConverter } from '../adf-to-markdown/marks/BackgroundColorConverter.js';
import { SubsupConverter } from '../adf-to-markdown/marks/SubsupConverter.js';

/**
 * Core engine for ADF to Markdown conversion
 * Uses the proven ConverterRegistry approach
 */
export class AdfToMarkdownEngine {
  private registry: ConverterRegistry;
  private validator: AdfValidator;
  private options: Required<ConversionOptions>;

  constructor(options: ConversionOptions = {}) {
    this.options = {
      strict: false,
      gfm: true,
      frontmatter: true,
      enableAdfExtensions: true,
      maxDepth: 5,
      enableLogging: false,
      preserveWhitespace: false,
      validateInput: false,
      preserveUnknownNodes: true,
      maxRetries: 3,
      retryDelay: 100,
      fallbackStrategy: 'best-effort',
      ...options
    } as Required<ConversionOptions>;

    this.registry = new ConverterRegistry();
    this.validator = new AdfValidator();
    this.registerConverters();
  }

  /**
   * Convert ADF document to markdown
   */
  convert(adf: ADFDocument): string {
    if (!adf || typeof adf !== 'object') {
      if (this.options.strict) {
        throw new Error('Invalid ADF document: must be a non-null object');
      }
      return '';
    }

    if (adf.type !== 'doc') {
      if (this.options.strict) {
        throw new Error('Invalid ADF document: root node must be of type "doc"');
      }
      // Graceful fallback: try to convert anyway
    }

    try {
      // Validate ADF structure
      const validation = this.validator.validate(adf);
      if (!validation.valid && this.options.strict) {
        throw new Error(`Invalid ADF structure: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // Convert using registered converters
      return this.convertAdfToMarkdown(adf);
    } catch (error) {
      if (this.options.strict) {
        throw error;
      }
      
      if (this.options.enableLogging) {
        console.warn('ADF to Markdown conversion failed, returning empty string:', error);
      }
      
      return '';
    }
  }

  /**
   * Convert ADF document to markdown with validation
   */
  convertWithValidation(adf: ADFDocument): { markdown: string; warnings: string[] } {
    const warnings: string[] = [];
    
    // Validate input
    const validation = this.validator.validate(adf);
    if (!validation.valid) {
      if (this.options.strict) {
        throw new Error(`Invalid ADF structure: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      warnings.push(...validation.errors.map(e => e.message));
    }
    
    try {
      const markdown = this.convertAdfToMarkdown(adf);
      return { markdown, warnings };
    } catch (error) {
      if (this.options.strict) {
        throw error;
      }
      
      warnings.push(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { markdown: '', warnings };
    }
  }

  /**
   * Get conversion statistics
   */
  getStats(adf: ADFDocument): {
    nodeCount: number;
    hasAdfExtensions: boolean;
    hasGfmFeatures: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    supportedTypes: string[];
    unsupportedTypes: string[];
  } {
    const stats = {
      nodeCount: 0,
      hasAdfExtensions: false,
      hasGfmFeatures: false,
      supportedTypes: new Set<string>(),
      unsupportedTypes: new Set<string>()
    };

    const visit = (node: ADFNode) => {
      stats.nodeCount++;
      
      // Check if converter exists for this node type
      try {
        this.registry.getNodeConverter(node.type);
        stats.supportedTypes.add(node.type);
      } catch {
        stats.unsupportedTypes.add(node.type);
      }
      
      // Check for ADF extensions
      if (['panel', 'expand', 'mediaSingle', 'mediaGroup', 'mention', 'emoji', 'date', 'status'].includes(node.type)) {
        stats.hasAdfExtensions = true;
      }
      
      // Check for GFM features
      if (['table', 'tableRow', 'tableHeader', 'tableCell'].includes(node.type)) {
        stats.hasGfmFeatures = true;
      }
      
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(visit);
      }
    };

    if (adf.content) {
      adf.content.forEach(visit);
    }

    const complexity = stats.nodeCount < 10 ? 'simple' : stats.nodeCount < 50 ? 'moderate' : 'complex';

    return {
      nodeCount: stats.nodeCount,
      hasAdfExtensions: stats.hasAdfExtensions,
      hasGfmFeatures: stats.hasGfmFeatures,
      complexity,
      supportedTypes: Array.from(stats.supportedTypes),
      unsupportedTypes: Array.from(stats.unsupportedTypes)
    };
  }

  /**
   * Register all node and mark converters
   */
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
      new TaskListConverter(),
      new TaskItemConverter(),
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

  /**
   * Core ADF to markdown conversion logic
   */
  private convertAdfToMarkdown(adf: ADFDocument): string {
    const context: ConversionContext = {
      convertChildren: (nodes: ADFNode[]) => {
        if (!Array.isArray(nodes)) return '';
        return nodes.map(node => {
          try {
            const converter = this.registry.getNodeConverter(node.type);
            return converter.toMarkdown(node, context);
          } catch (error: unknown) {
            // Graceful degradation for unknown node types
            if (this.options.enableLogging) {
              console.warn(`Failed to convert node type "${node.type}":`, error);
            }
            return this.options.preserveUnknownNodes ? `<!-- Unknown node: ${node.type} -->` : '';
          }
        }).join('');
      },
      depth: 0,
      options: {
        ...this.options,
        registry: this.registry
      }
    };
    
    // Handle missing or invalid content array
    if (!adf.content || !Array.isArray(adf.content)) {
      return '';
    }
    
    // For the top-level document, we need to join block elements with double newlines
    const content = adf.content.map(node => {
      try {
        const converter = this.registry.getNodeConverter(node.type);
        return converter.toMarkdown(node, context);
      } catch (error: unknown) {
        // Graceful degradation for unknown node types
        if (this.options.enableLogging) {
          console.warn(`Failed to convert node type "${node.type}":`, error);
        }
        return this.options.preserveUnknownNodes ? `<!-- Unknown node: ${node.type} -->` : '';
      }
    }).filter(content => content.length > 0).join('\n\n');
    
    return content;
  }
}