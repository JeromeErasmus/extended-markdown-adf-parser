/**
 * @file MarkdownToAdfEngine.ts
 * @description Core engine for converting Markdown to ADF - extracted from EnhancedMarkdownParser
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { remarkAdf } from '../remark/remark-adf.js';
import type { Root } from 'mdast';
import type { ADFDocument, ConversionOptions } from '../../types/index.js';
import { ASTBuilder } from '../markdown-to-adf/ASTBuilder.js';
import { processMetadataComments } from '../../utils/metadata-comments.js';

/**
 * Core engine for Markdown to ADF conversion
 * Contains all the proven logic from EnhancedMarkdownParser
 */
export class MarkdownToAdfEngine {
  private processor: any; // Using any to avoid complex unified type issues
  private astBuilder: ASTBuilder;
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

    this.astBuilder = new ASTBuilder({
      strict: this.options.strict,
      preserveUnknownNodes: this.options.preserveUnknownNodes
    });

    this.processor = this.createProcessor();
  }

  /**
   * Create the unified processor with plugins
   */
  private createProcessor(): any {
    let processor: any = unified()
      .use(remarkParse);

    // Add frontmatter support
    if (this.options.frontmatter) {
      processor = processor.use(remarkFrontmatter, ['yaml']);
    }

    // Add GitHub Flavored Markdown support
    if (this.options.gfm) {
      processor = processor.use(remarkGfm);
    }

    // Add ADF extensions
    if (this.options.enableAdfExtensions) {
      processor = processor.use(remarkAdf, {
        strict: this.options.strict
      });
    }

    return processor;
  }

  /**
   * Convert markdown to ADF synchronously
   */
  convert(markdown: string): ADFDocument {
    if (!markdown || typeof markdown !== 'string') {
      if (this.options.strict) {
        throw new Error('Invalid markdown input: must be a non-empty string');
      }
      return {
        version: 1,
        type: 'doc',
        content: []
      };
    }

    if (markdown.trim().length === 0) {
      return {
        version: 1,
        type: 'doc',
        content: []
      };
    }

    try {
      // Preprocess to fix consecutive HTML comments and handle nested ADF blocks
      const preprocessedMarkdown = this.preprocessNestedAdfBlocks(this.preprocessConsecutiveHtmlComments(markdown));
      
      // Parse markdown to mdast using unified
      const tree = this.processor.parse(preprocessedMarkdown);
      const processedTree = this.processor.runSync(tree) as Root;

      // Convert to ADF synchronously
      return this.convertMdastToAdfSync(processedTree);
    } catch (error) {
      if (this.options.strict) {
        throw new Error(`Failed to convert markdown to ADF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      if (this.options.enableLogging) {
        console.warn('Markdown to ADF conversion failed, returning fallback:', error);
      }
      
      // Fallback to basic paragraph
      return {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: markdown
          }]
        }]
      };
    }
  }

  /**
   * Convert markdown to ADF asynchronously
   */
  async convertAsync(markdown: string): Promise<ADFDocument> {
    if (!markdown || typeof markdown !== 'string') {
      if (this.options.strict) {
        throw new Error('Invalid markdown input: must be a non-empty string');
      }
      return {
        version: 1,
        type: 'doc',
        content: []
      };
    }

    if (markdown.trim().length === 0) {
      return {
        version: 1,
        type: 'doc',
        content: []
      };
    }

    try {
      // Preprocess to fix consecutive HTML comments and handle nested ADF blocks
      const preprocessedMarkdown = this.preprocessNestedAdfBlocks(this.preprocessConsecutiveHtmlComments(markdown));
      
      // Parse markdown to mdast using unified
      const tree = this.processor.parse(preprocessedMarkdown);
      const processedTree = await this.processor.run(tree) as Root;

      // Convert mdast to ADF using our AST builder
      const adf = await this.convertMdastToAdf(processedTree);
      return adf;
    } catch (error) {
      if (this.options.strict) {
        throw new Error(`Failed to convert markdown to ADF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      if (this.options.enableLogging) {
        console.warn('Async markdown to ADF conversion failed, returning fallback:', error);
      }
      
      // Fallback to basic paragraph
      return {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: markdown
          }]
        }]
      };
    }
  }

  /**
   * Validate markdown input
   */
  async validate(markdown: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const tree = this.processor.parse(markdown);
      const processedTree = await this.processor.run(tree) as Root;

      // Additional validation of the AST structure
      this.validateMdastTree(processedTree, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Get parsing statistics
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
    const startTime = Date.now();
    
    try {
      const tree = this.processor.parse(markdown);
      const processedTree = await this.processor.run(tree) as Root;
      
      // Post-process for ADF fence blocks and convert to ADF to analyze the final result
      const processedTreeWithAdf = this.postProcessAdfFenceBlocks(processedTree);
      const adf = await this.convertMdastToAdf(processedTreeWithAdf);
      
      const stats = this.analyzeAdf(adf);
      
      return {
        ...stats,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        nodeCount: 0,
        adfBlockCount: 0,
        hasGfmFeatures: false,
        hasFrontmatter: false,
        hasAdfExtensions: false,
        complexity: 'simple',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Convert mdast tree to ADF document (async)
   */
  private async convertMdastToAdf(tree: Root): Promise<ADFDocument> {
    // Post-process the tree in stages
    let processedTree = tree;
    
    // 1. Process metadata comments first (before ADF fence block processing)
    processedTree = processMetadataComments(processedTree);
    
    // 2. Convert ADF fence blocks
    processedTree = this.postProcessAdfFenceBlocks(processedTree);

    // Extract frontmatter if present
    let frontmatter: any = null;
    const frontmatterNode = processedTree.children.find(node => node.type === 'yaml');
    
    if (frontmatterNode && 'value' in frontmatterNode) {
      try {
        if (frontmatterNode.type === 'yaml') {
          const yaml = await import('js-yaml');
          frontmatter = yaml.load(frontmatterNode.value);
        }
      } catch (error) {
        // Ignore frontmatter parsing errors in non-strict mode
        if (this.options.strict) {
          throw new Error(`Frontmatter parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Convert the tree using AST builder
    const adf = this.astBuilder.buildADFFromMdast(processedTree, frontmatter);
    
    // Post-process to remove empty paragraphs with only whitespace
    return this.cleanupEmptyParagraphs(adf);
  }

  /**
   * Synchronous version of mdast to ADF conversion
   */
  private convertMdastToAdfSync(tree: Root): ADFDocument {
    try {
      // Post-process the tree in stages
      let processedTree = tree;
      
      // 1. Process metadata comments first (before ADF fence block processing)
      processedTree = processMetadataComments(processedTree);
      
      // 2. Convert ADF fence blocks
      processedTree = this.postProcessAdfFenceBlocks(processedTree);
      
      // For sync version, handle frontmatter more simply
      let frontmatter: any = null;
      const frontmatterNode = processedTree.children.find(node => node.type === 'yaml');
      
      if (frontmatterNode && 'value' in frontmatterNode) {
        try {
          // Use a sync YAML parser or basic JSON parsing
          const yamlContent = frontmatterNode.value as string;
          
          // Try to parse as JSON first (simpler)
          if (yamlContent.trim().startsWith('{')) {
            frontmatter = JSON.parse(yamlContent);
          } else {
            // For proper YAML parsing in sync mode, we'd need a sync YAML library
            // For now, extract basic key-value pairs
            const lines = yamlContent.split('\n');
            frontmatter = {};
            for (const line of lines) {
              const match = line.match(/^(\w+):\s*(.+)$/);
              if (match) {
                frontmatter[match[1]] = match[2];
              }
            }
          }
        } catch (error) {
          if (this.options.strict) {
            throw new Error(`Frontmatter parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Convert the tree using AST builder
      const adf = this.astBuilder.buildADFFromMdast(processedTree, frontmatter);
      
      // Post-process to remove empty paragraphs with only whitespace
      return this.cleanupEmptyParagraphs(adf);
    } catch (error) {
      if (this.options.strict) {
        throw error;
      }
      
      // Fallback conversion
      return {
        version: 1,
        type: 'doc',
        content: []
      };
    }
  }

  /**
   * Post-process mdast tree to convert code blocks with ADF languages to ADF fence nodes
   * Also handles nested ADF fence blocks within text content
   */
  private postProcessAdfFenceBlocks(tree: Root): Root {
    const adfBlockTypes = new Set(['panel', 'expand', 'nestedExpand', 'mediaSingle', 'mediaGroup']);
    
    
    const processedTree = JSON.parse(JSON.stringify(tree)); // Deep clone
    
    // Multi-pass processing: keep processing until no more ADF fence blocks are found
    let hasChanges = true;
    let passCount = 0;
    const maxPasses = 5; // Prevent infinite loops
    
    while (hasChanges && passCount < maxPasses) {
      hasChanges = false;
      passCount++;
      
      const processNode = (node: any): void => {
        // Handle direct code blocks with ADF languages at any nesting level
        if (node.type === 'code' && node.lang && adfBlockTypes.has(node.lang)) {
          
          // Convert code block to adfFence node
          const attributes = this.parseAdfLanguageString(node.lang, node.meta || '');
          
          node.type = 'adfFence';
          node.nodeType = node.lang;
          node.attributes = attributes;
          
          // Parse the code content as markdown to get structured children
          // But for mediaGroup, we need to preserve the raw value for direct processing
          try {
            const innerProcessor = this.createInnerProcessor();
            const innerTree = innerProcessor.parse(node.value || '');
            const processedInnerTree = innerProcessor.runSync(innerTree);
            
            node.children = processedInnerTree.children;
            
            // Only delete value for non-mediaGroup blocks
            // mediaGroup needs raw value for media reference extraction
            if (node.lang !== 'mediaGroup') {
              delete node.value; // Remove text value since we now have children
            }
          } catch (error) {
            // If processing fails, keep the raw value
            if (this.options.enableLogging) {
              console.warn('Failed to process ADF fence block content:', error);
            }
          }
          
          // Remove code block properties
          delete node.lang;
          delete node.meta;
          
          hasChanges = true;
        }
        
        // Handle text nodes that might contain nested ADF fence blocks
        if (node.type === 'text' && node.value && typeof node.value === 'string') {
          const textContent = node.value;
          const adfFencePattern = /^~~~(panel|expand|nestedExpand|mediaSingle|mediaGroup)([^\n]*)\n([\s\S]*?)\n~~~$/;
          
          if (adfFencePattern.test(textContent.trim())) {
            const match = textContent.trim().match(adfFencePattern);
            if (match) {
              const [, nodeType, attributesString, content] = match;
              
              // Parse the markdown content inside the ADF fence block
              try {
                const innerProcessor = this.createInnerProcessor();
                const innerTree = innerProcessor.parse(content);
                const processedInnerTree = innerProcessor.runSync(innerTree);
                
                // Convert text node to adfFence node with processed content
                node.type = 'adfFence';
                node.nodeType = nodeType;
                node.attributes = this.parseAdfLanguageString(nodeType, attributesString.trim());
                node.children = processedInnerTree.children;
                
                delete node.value; // Remove text value since we now have children
                
                hasChanges = true;
              } catch (error) {
                // If processing fails, keep as text
                if (this.options.enableLogging) {
                  console.warn('Failed to process nested ADF fence block:', error);
                }
              }
            }
          }
        }
        
        // Recursively process children
        if (node.children) {
          node.children.forEach(processNode);
        }
      };
      
      processedTree.children.forEach(processNode);
    }
    
    return processedTree;
  }

  /**
   * Create a minimal processor for parsing inner content of ADF fence blocks
   */
  private createInnerProcessor(): any {
    return this.processor;
  }

  /**
   * Parse ADF language string with attributes like "panel type=info title=Test"
   */
  private parseAdfLanguageString(lang: string, meta: string): Record<string, any> {
    const attributes: Record<string, any> = {};
    
    // Combine lang and meta for parsing
    const fullString = `${lang} ${meta}`.trim();
    
    // Simple key=value parser
    const pairs = fullString.match(/(\w+)=([^"'\s]+|"[^"]*"|'[^']*')/g) || [];
    
    for (const pair of pairs) {
      const [, key, value] = pair.match(/(\w+)=([^"'\s]+|"[^"]*"|'[^']*')/) || [];
      if (key && value && key !== lang) { // Skip the language itself
        let parsedValue: any = value;
        
        // Remove quotes if present
        if ((parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
            (parsedValue.startsWith("'") && parsedValue.endsWith("'"))) {
          parsedValue = parsedValue.slice(1, -1);
        }
        
        // Special handling for 'attrs' key containing JSON
        if (key === 'attrs') {
          try {
            const parsedAttrs = JSON.parse(parsedValue);
            if (typeof parsedAttrs === 'object' && parsedAttrs !== null) {
              // Merge the parsed attributes into the main attributes object
              Object.assign(attributes, parsedAttrs);
              continue; // Don't add 'attrs' as a literal key
            }
          } catch (error) {
            // If JSON parsing fails, treat it as a regular attribute
            attributes[key] = parsedValue;
            continue;
          }
        }
        
        // Try to parse as number or boolean
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (!isNaN(Number(parsedValue)) && parsedValue !== '') parsedValue = Number(parsedValue);
        
        attributes[key] = parsedValue;
      }
    }
    
    return attributes;
  }

  /**
   * Remove paragraphs that contain only whitespace text nodes
   */
  private cleanupEmptyParagraphs(adf: ADFDocument): ADFDocument {
    const cleanupNode = (node: any): boolean => {
      // If this is a paragraph with only whitespace text nodes, remove it
      if (node.type === 'paragraph' && node.content) {
        const hasOnlyWhitespace = node.content.every((child: any) => 
          child.type === 'text' && (!child.text || child.text.trim() === '')
        );
        
        if (hasOnlyWhitespace) {
          return false; // Mark for removal
        }
      }
      
      // Recursively clean up children
      if (node.content && Array.isArray(node.content)) {
        node.content = node.content.filter(cleanupNode);
      }
      
      return true; // Keep this node
    };
    
    const cleanedAdf = { ...adf };
    if (cleanedAdf.content) {
      cleanedAdf.content = cleanedAdf.content.filter(cleanupNode);
    }
    
    return cleanedAdf;
  }

  /**
   * Preprocess markdown to fix consecutive HTML comments that break parsing
   */
  private preprocessConsecutiveHtmlComments(markdown: string): string {
    // Fix consecutive HTML comments by adding a space between them
    return markdown.replace(/-->(\s*<!--)/g, '-->\n<!-- ');
  }

  /**
   * Preprocess nested ADF blocks to ensure they're properly parsed as code blocks
   * This handles cases where ADF fence blocks are nested inside other ADF blocks
   */
  private preprocessNestedAdfBlocks(markdown: string): string {
    // Find nested ADF fence blocks within other ADF fence blocks
    const adfBlockPattern = /^~~~(expand|panel|mediaSingle|mediaGroup|nestedExpand)([^\n]*)\n([\s\S]*?)\n~~~$/gm;
    
    return markdown.replace(adfBlockPattern, (match, blockType, attributes, content) => {
      // Process the content to ensure nested ADF blocks are properly formatted
      const processedContent = this.processNestedAdfContent(content);
      return `~~~${blockType}${attributes}\n${processedContent}\n~~~`;
    });
  }

  /**
   * Process content inside ADF blocks to ensure nested ADF blocks are recognized
   */
  private processNestedAdfContent(content: string): string {
    // Look for potential nested ADF blocks that might not be properly formatted
    const nestedAdfPattern = /^~~~(panel|expand|mediaSingle|mediaGroup|nestedExpand)([^\n]*)/gm;
    
    // Replace with proper code block syntax to ensure they're parsed as code blocks
    return content.replace(nestedAdfPattern, (match, blockType, attributes) => {
      // Ensure the nested block is treated as a proper code fence
      return `\`\`\`${blockType}${attributes}`;
    }).replace(/^~~~$/gm, '```'); // Replace closing ~~~ with closing ```
  }

  /**
   * Validate mdast tree structure
   */
  private validateMdastTree(tree: Root, errors: string[], warnings: string[]): void {
    const visit = (node: any, depth: number = 0) => {
      if (depth > this.options.maxDepth) {
        warnings.push(`Maximum nesting depth (${this.options.maxDepth}) exceeded`);
        return;
      }
      
      if (node.children) {
        node.children.forEach((child: any) => visit(child, depth + 1));
      }
    };
    
    visit(tree);
  }

  /**
   * Analyze ADF document for statistics
   */
  private analyzeAdf(adf: ADFDocument): {
    nodeCount: number;
    adfBlockCount: number;
    hasGfmFeatures: boolean;
    hasFrontmatter: boolean;
    hasAdfExtensions: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    let nodeCount = 0;
    let adfBlockCount = 0;
    let hasGfmFeatures = false;
    let hasAdfExtensions = false;
    
    const visit = (node: any) => {
      nodeCount++;
      
      if (['panel', 'expand', 'mediaSingle', 'mediaGroup'].includes(node.type)) {
        adfBlockCount++;
        hasAdfExtensions = true;
      }
      
      if (['table', 'tableRow', 'tableHeader', 'tableCell'].includes(node.type)) {
        hasGfmFeatures = true;
      }
      
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(visit);
      }
    };
    
    if (adf.content) {
      adf.content.forEach(visit);
    }
    
    const complexity = nodeCount < 10 ? 'simple' : nodeCount < 50 ? 'moderate' : 'complex';
    
    return {
      nodeCount,
      adfBlockCount,
      hasGfmFeatures,
      hasFrontmatter: false, // TODO: Detect frontmatter in ADF
      hasAdfExtensions,
      complexity
    };
  }
}