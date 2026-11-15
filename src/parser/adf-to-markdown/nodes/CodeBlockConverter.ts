/**
 * @file Code Block node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/codeblock/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, CodeBlockNode } from '../../../types';

/**
 * Code Block Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/codeblock/
 * 
 * Purpose:
 * Code Block nodes display formatted code with syntax highlighting
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "codeBlock",
 *   "attrs": {
 *     "language": "javascript"
 *   },
 *   "content": [
 *     { "type": "text", "text": "console.log('Hello World');" }
 *   ]
 * }
 * ```
 * 
 * Markdown Representation:
 * ```markdown
 * ```javascript
 * console.log('Hello World');
 * ```
 * ```
 */
export class CodeBlockConverter implements NodeConverter {
  nodeType = 'codeBlock';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const codeBlockNode = node as CodeBlockNode;
    
    if (!codeBlockNode.content || codeBlockNode.content.length === 0) {
      return '```\n\n```';
    }

    const language = codeBlockNode.attrs?.language || '';
    
    // Extract text content from text nodes
    const codeContent = codeBlockNode.content
      .map(textNode => textNode.text || '')
      .join('');
    
    // Add custom attributes if present (beyond language)
    const customAttrs = { ...codeBlockNode.attrs };
    if ('language' in customAttrs) {
      delete (customAttrs as any).language;
    }
    
    // Use a fence longer than any backtick run in the content so a nested fence
    // (e.g. a code sample showing ``` itself) doesn't close the block early (issue #20)
    const longestBacktickRun = Math.max(0, ...(codeContent.match(/`+/g) || []).map(run => run.length));
    const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1));

    let result = `${fence}${language}\n${codeContent}\n${fence}`;
    
    // Add metadata for custom attributes
    if (Object.keys(customAttrs).length > 0) {
      result += `<!-- adf:codeblock attrs='${JSON.stringify(customAttrs)}' -->`;
    }
    
    return result;
  }
}