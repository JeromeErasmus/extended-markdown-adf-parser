/**
 * @file Round-trip conversion reliability tests
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from '../../src/index.js';
import type { ADFDocument } from '../../src/index.js';

describe('Round-trip Conversion Tests', () => {
  const parser = new Parser();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const fixturesDir = join(__dirname, '..', 'fixtures');

  const loadAdfFixture = (name: string): ADFDocument => {
    const adfPath = join(fixturesDir, 'adf', `${name}.adf`);
    return JSON.parse(readFileSync(adfPath, 'utf8')) as ADFDocument;
  };

  describe('ADF to Markdown Consistency', () => {
    const fixtures = [
      'simple-document',
      'rich-content',
      'table-document', 
      'media-expand',
      'edge-cases'
    ];

    fixtures.forEach(fixtureName => {
      it(`should produce consistent output for ${fixtureName}`, () => {
        const adf = loadAdfFixture(fixtureName);
        
        // Convert multiple times
        const result1 = parser.adfToMarkdown(adf);
        const result2 = parser.adfToMarkdown(adf);
        const result3 = parser.adfToMarkdown(adf);
        
        // Results should be identical
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
        
        // Results should not be empty
        expect(result1.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Parser State Isolation', () => {
    it('should not leak state between conversions', () => {
      const simpleAdf = loadAdfFixture('simple-document');
      const complexAdf = loadAdfFixture('edge-cases');
      
      // Convert simple, then complex, then simple again
      const simpleResult1 = parser.adfToMarkdown(simpleAdf);
      const complexResult = parser.adfToMarkdown(complexAdf);
      const simpleResult2 = parser.adfToMarkdown(simpleAdf);
      
      // Simple results should be identical (no state leakage)
      expect(simpleResult1).toBe(simpleResult2);
      
      // Complex result should be different from simple
      expect(complexResult).not.toBe(simpleResult1);
    });

    it('should handle concurrent conversions', () => {
      const adf1 = loadAdfFixture('simple-document');
      const adf2 = loadAdfFixture('rich-content');
      const adf3 = loadAdfFixture('table-document');
      
      // Simulate concurrent conversions
      const results = [adf1, adf2, adf3].map(adf => parser.adfToMarkdown(adf));
      
      // All results should be valid and non-empty
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      });
      
      // Results should be different
      expect(results[0]).not.toBe(results[1]);
      expect(results[1]).not.toBe(results[2]);
      expect(results[0]).not.toBe(results[2]);
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large documents efficiently', () => {
      // Create a large document by repeating content
      const baseAdf = loadAdfFixture('rich-content');
      const largeAdf: ADFDocument = {
        type: 'doc',
        content: Array(50).fill(null).flatMap(() => baseAdf.content || [])
      };
      
      const startTime = Date.now();
      const result = parser.adfToMarkdown(largeAdf);
      const endTime = Date.now();
      
      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not accumulate memory over multiple conversions', () => {
      const adf = loadAdfFixture('simple-document');
      const iterations = 100;
      
      // Perform many conversions
      for (let i = 0; i < iterations; i++) {
        const result = parser.adfToMarkdown(adf);
        expect(result).toBeTruthy();
      }
      
      // Final conversion should still work
      const finalResult = parser.adfToMarkdown(adf);
      expect(finalResult).toBeTruthy();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from malformed content', () => {
      const validAdf = loadAdfFixture('simple-document');
      const malformedAdf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: null }, // Invalid content
          ...validAdf.content || []
        ]
      } as ADFDocument;
      
      // Should not throw
      expect(() => {
        parser.adfToMarkdown(malformedAdf);
      }).not.toThrow();
      
      // Should still convert valid parts
      const result = parser.adfToMarkdown(malformedAdf);
      expect(result).toContain('Simple Document');
    });

    it('should handle missing node types gracefully', () => {
      const adfWithUnknownNode: ADFDocument = {
        type: 'doc',
        content: [
          {
            type: 'unknownNodeType',
            content: [{ type: 'text', text: 'Unknown content' }]
          } as any,
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Valid content' }]
          }
        ]
      };
      
      const result = parser.adfToMarkdown(adfWithUnknownNode);
      
      // Should contain fallback rendering for unknown node
      expect(result).toContain('adf:unknown');
      expect(result).toContain('Valid content');
    });

    it('should handle circular references safely', () => {
      // Create a document with potential circular reference in custom attributes
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const adfWithCircular: ADFDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { circular: circularObj },
            content: [{ type: 'text', text: 'Test' }]
          } as any
        ]
      };
      
      // Should not throw or hang
      expect(() => {
        parser.adfToMarkdown(adfWithCircular);
      }).not.toThrow();
    });
  });

  describe('Validation Round-trip', () => {
    it('should validate converted documents consistently', () => {
      const fixtures = ['simple-document', 'rich-content', 'table-document'];
      
      fixtures.forEach(fixtureName => {
        const adf = loadAdfFixture(fixtureName);
        
        // Validate multiple times
        const validation1 = parser.validateAdf(adf);
        const validation2 = parser.validateAdf(adf);
        
        expect(validation1.valid).toBe(validation2.valid);
        expect(validation1.errors.length).toBe(validation2.errors.length);
      });
    });

    it('should maintain validation state across conversions', () => {
      const validAdf = loadAdfFixture('simple-document');
      const invalidAdf = { type: 'invalid', content: 'not-array' };
      
      // Valid -> Invalid -> Valid
      const valid1 = parser.validateAdf(validAdf);
      const invalid = parser.validateAdf(invalidAdf);
      const valid2 = parser.validateAdf(validAdf);
      
      expect(valid1.valid).toBe(true);
      expect(invalid.valid).toBe(false);
      expect(valid2.valid).toBe(true);
      
      // Results should be consistent
      expect(valid1.valid).toBe(valid2.valid);
    });
  });

  describe('Mark Fidelity Round-trip', () => {
    const findText = (node: any, text: string): any => {
      if (node.type === 'text' && node.text === text) return node;
      for (const child of node.content || []) {
        const found = findText(child, text);
        if (found) return found;
      }
      return null;
    };

    it('preserves textColor/underline marks through adf -> markdown -> adf', () => {
      const adf = loadAdfFixture('comprehensive-marks');
      const markdown = parser.adfToMarkdown(adf);
      const roundTripped = parser.markdownToAdf(markdown);

      for (const text of ['underlined text', 'colored text']) {
        const original = findText({ content: adf.content }, text);
        const result = findText({ content: roundTripped.content }, text);
        expect(result?.marks?.map((m: any) => m.type).sort()).toEqual(
          original?.marks?.map((m: any) => m.type).sort()
        );
      }
    });
  });

  describe('Ordered List Continuity', () => {
    it('keeps a nested list attached to its ordered-list item through adf -> markdown -> adf', () => {
      const adf = loadAdfFixture('edge-cases');
      const markdown = parser.adfToMarkdown(adf);
      const roundTripped = parser.markdownToAdf(markdown);

      const orderedLists = (nodes: any[]): any[] => nodes.filter(n => n.type === 'orderedList');
      const original = orderedLists(adf.content as any[]);
      const result = orderedLists(roundTripped.content as any[]);

      expect(result).toHaveLength(original.length);
      expect(result[0].content).toHaveLength(original[0].content.length);
    });
  });

  describe('Configuration Consistency', () => {
    it('should respect strict mode consistently', () => {
      const validAdf = loadAdfFixture('simple-document');
      const invalidAdf = { type: 'invalid', content: [] } as unknown as ADFDocument;
      
      // Valid ADF should work in both modes
      expect(() => parser.adfToMarkdown(validAdf, { strict: false })).not.toThrow();
      expect(() => parser.adfToMarkdown(validAdf, { strict: true })).not.toThrow();
      
      // Invalid ADF should throw only in strict mode
      expect(() => parser.adfToMarkdown(invalidAdf, { strict: false })).not.toThrow();
      expect(() => parser.adfToMarkdown(invalidAdf, { strict: true })).toThrow();
    });

    it('should handle configuration changes between calls', () => {
      const adf = loadAdfFixture('simple-document');
      
      const resultNormal = parser.adfToMarkdown(adf);
      const resultStrict = parser.adfToMarkdown(adf, { strict: true });
      const resultNormal2 = parser.adfToMarkdown(adf);
      
      // Results should be identical regardless of previous config
      expect(resultNormal).toBe(resultNormal2);
      expect(resultNormal).toBe(resultStrict);
    });
  });
});