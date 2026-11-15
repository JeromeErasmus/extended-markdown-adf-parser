/**
 * @file Table Header node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/tableheader/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, TableHeaderNode } from '../../../types';

/**
 * Table Header Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/tableheader/
 * 
 * Purpose:
 * Table Header nodes represent header cells in table rows
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "tableHeader",
 *   "attrs": {
 *     "colspan": 1,
 *     "rowspan": 1,
 *     "colwidth": [120]
 *   },
 *   "content": [
 *     {
 *       "type": "paragraph",
 *       "content": [
 *         { "type": "text", "text": "Header Text" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * 
 * Markdown Representation:
 * ```markdown
 * Header Text (within table cell)
 * ```
 */
export class TableHeaderConverter implements NodeConverter {
  nodeType = 'tableHeader';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const tableHeaderNode = node as TableHeaderNode;
    
    if (!tableHeaderNode.content || tableHeaderNode.content.length === 0) {
      return '';
    }

    // Convert content - typically paragraphs with text
    // Escape literal pipes so they aren't read as extra column delimiters (issue #20)
    const content = context.convertChildren(tableHeaderNode.content).replace(/\|/g, '\\|');

    // Handle colspan by duplicating content across cells (basic approach)
    const colspan = tableHeaderNode.attrs?.colspan || 1;
    if (colspan > 1) {
      // For now, just indicate colspan in content
      const result = content + ` <!-- colspan=${colspan} -->`;
      
      // Add metadata for other custom attributes
      const customAttrs = { ...tableHeaderNode.attrs };
      delete (customAttrs as any).colspan;
      
      if (Object.keys(customAttrs).length > 0) {
        return `${result}<!-- adf:tableHeader attrs='${JSON.stringify(customAttrs)}' -->`;
      }
      
      return result;
    }
    
    // Add metadata for custom attributes (excluding default values)
    if (tableHeaderNode.attrs && Object.keys(tableHeaderNode.attrs).length > 0) {
      const customAttrs = { ...tableHeaderNode.attrs };
      
      // Remove default values that shouldn't show in metadata
      if ((customAttrs as any).colspan === 1) {
        delete (customAttrs as any).colspan;
      }
      if ((customAttrs as any).rowspan === 1) {
        delete (customAttrs as any).rowspan;
      }
      
      if (Object.keys(customAttrs).length > 0) {
        return `${content}<!-- adf:tableHeader attrs='${JSON.stringify(customAttrs)}' -->`;
      }
    }
    
    return content;
  }
}