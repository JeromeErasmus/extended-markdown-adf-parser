/**
 * @file StreamingParser.ts
 * @description Streaming parser for large ADF documents and markdown files
 */

import { Transform, Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import type { ADFDocument, ADFNode } from '../types';
import { Parser } from '../index.js';
import { safeJSONStringify } from '../utils/json-utils.js';

export interface StreamingOptions {
  chunkSize?: number; // Default 64KB
  maxMemoryUsage?: number; // Default 100MB
  onProgress?: (bytesProcessed: number, totalBytes?: number) => void;
  onChunk?: (chunk: string) => void;
  timeout?: number; // Default 30 seconds
}

export interface StreamingResult<T> {
  data: T;
  bytesProcessed: number;
  chunksProcessed: number;
  processingTime: number;
  memoryPeak: number;
}

/**
 * Streaming parser for handling large documents efficiently
 */
export class StreamingParser {
  private parser: Parser;
  private options: StreamingOptions;

  constructor(options: StreamingOptions = {}) {
    this.parser = new Parser({ enableAdfExtensions: true });
    this.options = {
      chunkSize: 64 * 1024, // 64KB
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      timeout: 30 * 1000, // 30 seconds
      ...options
    };
  }

  /**
   * Stream convert ADF to markdown
   */
  async *adfToMarkdownStream(
    adfStream: Readable,
    options: StreamingOptions = {}
  ): AsyncGenerator<string, StreamingResult<void>, unknown> {
    const opts = { ...this.options, ...options };
    let buffer = '';
    let bytesProcessed = 0;
    let chunksProcessed = 0;
    const startTime = Date.now();
    let peakMemory = 0;

    try {
      for await (const chunk of adfStream) {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        bytesProcessed += Buffer.byteLength(chunkStr);
        chunksProcessed++;

        // Check buffer size limits
        if (buffer.length > opts.maxMemoryUsage! / 2) {
          throw new Error(`Buffer size exceeded limit`);
        }

        // Progress callback
        if (opts.onProgress) {
          opts.onProgress(bytesProcessed);
        }

        // Try to parse complete ADF documents from buffer
        const documents = this.extractCompleteDocuments(buffer);
        
        for (const doc of documents.documents) {
          try {
            const adf: ADFDocument = JSON.parse(doc);
            const markdown = this.parser.adfToMarkdown(adf);
            
            if (opts.onChunk) {
              opts.onChunk(markdown);
            }
            
            yield markdown;
          } catch (error) {
            console.warn('Failed to parse ADF document:', error);
            // Continue with next document
          }
        }
        
        // Update buffer with remaining content
        buffer = documents.remaining;
      }

      // Process any remaining content
      if (buffer.trim()) {
        try {
          const adf: ADFDocument = JSON.parse(buffer);
          const markdown = this.parser.adfToMarkdown(adf);
          
          if (opts.onChunk) {
            opts.onChunk(markdown);
          }
          
          yield markdown;
        } catch (error) {
          console.warn('Failed to parse final ADF document:', error);
        }
      }

    } catch (error) {
      throw new Error(`Streaming ADF to Markdown failed: ${error}`);
    }

    return {
      data: undefined as void,
      bytesProcessed,
      chunksProcessed,
      processingTime: Date.now() - startTime,
      memoryPeak: peakMemory
    };
  }

  /**
   * Stream convert markdown to ADF
   */
  async *markdownToAdfStream(
    markdownStream: Readable,
    options: StreamingOptions = {}
  ): AsyncGenerator<ADFDocument, StreamingResult<void>, unknown> {
    const opts = { ...this.options, ...options };
    let buffer = '';
    let bytesProcessed = 0;
    let chunksProcessed = 0;
    const startTime = Date.now();
    let peakMemory = 0;

    try {
      for await (const chunk of markdownStream) {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        bytesProcessed += Buffer.byteLength(chunkStr);
        chunksProcessed++;

        // Check buffer size limits
        if (buffer.length > opts.maxMemoryUsage! / 2) {
          throw new Error(`Buffer size exceeded limit`);
        }

        // Progress callback
        if (opts.onProgress) {
          opts.onProgress(bytesProcessed);
        }

        // Process markdown in document-sized chunks
        const documents = this.extractMarkdownDocuments(buffer);
        
        for (const doc of documents.documents) {
          try {
            const adf = await this.parser.markdownToAdfAsync(doc);
            
            if (opts.onChunk) {
              opts.onChunk(safeJSONStringify(adf));
            }
            
            yield adf;
          } catch (error) {
            console.warn('Failed to parse Markdown document:', error);
            // Continue with next document
          }
        }
        
        // Update buffer with remaining content
        buffer = documents.remaining;
      }

      // Process any remaining content
      if (buffer.trim()) {
        try {
          const adf = await this.parser.markdownToAdfAsync(buffer);
          
          if (opts.onChunk) {
            opts.onChunk(safeJSONStringify(adf));
          }
          
          yield adf;
        } catch (error) {
          console.warn('Failed to parse final Markdown document:', error);
        }
      }

    } catch (error) {
      throw new Error(`Streaming Markdown to ADF failed: ${error}`);
    }

    return {
      data: undefined as void,
      bytesProcessed,
      chunksProcessed,
      processingTime: Date.now() - startTime,
      memoryPeak: peakMemory
    };
  }

  /**
   * Convert large file using streaming
   */
  async convertLargeFile(
    inputPath: string,
    outputPath: string,
    direction: 'adf-to-md' | 'md-to-adf',
    options: StreamingOptions = {}
  ): Promise<StreamingResult<string>> {
    const fs = await import('fs');
    const path = await import('path');
    
    const inputStream = fs.createReadStream(inputPath, { 
      highWaterMark: options.chunkSize || this.options.chunkSize 
    });
    const outputStream = fs.createWriteStream(outputPath);
    
    const startTime = Date.now();
    let bytesProcessed = 0;
    let chunksProcessed = 0;
    let peakMemory = 0;

    try {
      if (direction === 'adf-to-md') {
        for await (const markdown of this.adfToMarkdownStream(inputStream, options)) {
          outputStream.write(markdown + '\n\n---\n\n');
          chunksProcessed++;
        }
      } else {
        for await (const adf of this.markdownToAdfStream(inputStream, options)) {
          outputStream.write(safeJSONStringify(adf, 2) + '\n');
          chunksProcessed++;
        }
      }
      
      outputStream.end();
      
      // Get file stats
      const stats = fs.statSync(inputPath);
      bytesProcessed = stats.size;

    } catch (error) {
      outputStream.destroy();
      throw error;
    }

    return {
      data: outputPath,
      bytesProcessed,
      chunksProcessed,
      processingTime: Date.now() - startTime,
      memoryPeak: peakMemory
    };
  }

  /**
   * Create a transform stream for real-time conversion
   */
  createTransformStream(direction: 'adf-to-md' | 'md-to-adf'): Transform {
    const self = this;
    let buffer = '';
    
    return new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        try {
          buffer += chunk.toString();
          
          if (direction === 'adf-to-md') {
            const result = self.extractCompleteDocuments(buffer);
            
            for (const doc of result.documents) {
              try {
                const adf: ADFDocument = JSON.parse(doc);
                const markdown = self.parser.adfToMarkdown(adf);
                this.push(markdown + '\n\n---\n\n');
              } catch (error) {
                console.warn('Transform error:', error);
              }
            }
            
            buffer = result.remaining;
          } else {
            const result = self.extractMarkdownDocuments(buffer);
            
            for (const doc of result.documents) {
              try {
                const adf = self.parser.markdownToAdf(doc);
                this.push(safeJSONStringify(adf, 2) + '\n');
              } catch (error) {
                console.warn('Transform error:', error);
              }
            }
            
            buffer = result.remaining;
          }
          
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
      
      flush(callback) {
        try {
          if (buffer.trim()) {
            if (direction === 'adf-to-md') {
              const adf: ADFDocument = JSON.parse(buffer);
              const markdown = self.parser.adfToMarkdown(adf);
              this.push(markdown);
            } else {
              const adf = self.parser.markdownToAdf(buffer);
              this.push(safeJSONStringify(adf, 2));
            }
          }
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  /**
   * Extract complete ADF documents from buffer
   */
  private extractCompleteDocuments(buffer: string): {
    documents: string[];
    remaining: string;
  } {
    const documents: string[] = [];
    let braceCount = 0;
    let start = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            start = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            documents.push(buffer.substring(start, i + 1));
          }
        }
      }
    }

    const remaining = braceCount > 0 ? buffer.substring(start) : '';
    return { documents, remaining };
  }

  /**
   * Extract complete markdown documents from buffer
   * Uses document separators or size-based chunking
   */
  private extractMarkdownDocuments(buffer: string): {
    documents: string[];
    remaining: string;
  } {
    const documents: string[] = [];
    
    // Look for document separators (---) or frontmatter boundaries
    const separatorRegex = /^---\s*$/gm;
    const matches = [...buffer.matchAll(separatorRegex)];
    
    if (matches.length > 0) {
      let lastEnd = 0;
      
      for (const match of matches) {
        if (match.index && match.index > lastEnd) {
          const document = buffer.substring(lastEnd, match.index).trim();
          if (document) {
            documents.push(document);
          }
          lastEnd = match.index + match[0].length;
        }
      }
      
      const remaining = buffer.substring(lastEnd);
      return { documents, remaining };
    }
    
    // Fallback: chunk by size if no separators found
    const chunkSize = this.options.chunkSize || 64 * 1024;
    if (buffer.length > chunkSize) {
      // Try to break at paragraph boundaries
      const paragraphBreak = buffer.lastIndexOf('\n\n', chunkSize);
      const breakPoint = paragraphBreak > chunkSize / 2 ? paragraphBreak : chunkSize;
      
      documents.push(buffer.substring(0, breakPoint));
      return { documents, remaining: buffer.substring(breakPoint) };
    }
    
    return { documents: [], remaining: buffer };
  }

  /**
   * Count nodes in ADF document for metrics
   */
  private countNodesInDocument(adf: ADFDocument): number {
    const countNodes = (nodes: ADFNode[]): number => {
      let count = 0;
      for (const node of nodes) {
        count++;
        if (node.content && Array.isArray(node.content)) {
          count += countNodes(node.content);
        }
      }
      return count;
    };
    
    return countNodes(adf.content || []);
  }
}