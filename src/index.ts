/**
 * @file Main entry point for the ADF parser library
 * @description Bidirectional parser for ADF and Extended Markdown
 */

// Import Parser for default export
import { Parser } from './parser/Parser.js';

// Export all types
export * from './types';
export { ParserError, ConversionError } from './errors';

// Export converter registry for external use
export { ConverterRegistry } from './parser/ConverterRegistry.js';

// Export test utilities  
export { normalizeMarkdownForComparison, expectMarkdownEqual, toMatchMarkdown } from './utils/test-utils.js';

// Export metadata utilities
export { isAdfMetadataComment, parseAdfMetadataComment } from './utils/metadata-comments.js';

// Export conversion engines
export { MarkdownToAdfEngine } from './parser/engines/MarkdownToAdfEngine.js';
export { AdfToMarkdownEngine } from './parser/engines/AdfToMarkdownEngine.js';

// Export parser components
export { MarkdownParser } from './parser/markdown-to-adf/MarkdownParser.js';
export { EnhancedMarkdownParser } from './parser/markdown-to-adf/EnhancedMarkdownParser.js';
export { Parser } from './parser/Parser.js';

// Export enhanced parser components
export { adfMicromarkExtension } from './parser/micromark/index.js';
export { remarkAdf } from './parser/remark/index.js';
export type { AdfFenceNode } from './parser/remark/index.js';


// Export streaming parser
export { StreamingParser } from './parser/StreamingParser.js';
export type { 
  StreamingOptions, 
  StreamingResult 
} from './parser/StreamingParser.js';

// Export error recovery
export { ErrorRecoveryManager } from './errors/ErrorRecovery.js';
export type {
  RecoveryOptions,
  RecoveryContext,
  RecoveryResult
} from './errors/ErrorRecovery.js';


// Default export for convenience
export default Parser;