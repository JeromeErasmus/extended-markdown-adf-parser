/**
 * @file debug-parsing.test.ts
 * @description Debug the parsing flow to understand why social elements aren't working
 */

import { Parser } from '../index.js';

describe('DEBUG - Parsing Flow Analysis', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser({ enableAdfExtensions: true });
  });

  it('should debug user mention parsing flow', async () => {
    const markdown = 'Hello {user:john.doe}!';
    const result = await parser.markdownToAdf(markdown);
    
    console.log('Input markdown:', JSON.stringify(markdown));
    console.log('Full result:', JSON.stringify(result, null, 2));
    console.log('Paragraph content:', JSON.stringify(result.content[0].content, null, 2));
    
    // Just verify we get a result - the actual parsing will be fixed next
    expect(result.type).toBe('doc');
    expect(result.content[0].type).toBe('paragraph');
  });

  it('should debug which parser path is being used', () => {
    // Check which methods are available
    console.log('Parser methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
    
    // Check enableAdfExtensions setting
    console.log('Parser options:', (parser as any).options);
    
    expect(parser).toBeDefined();
  });
});