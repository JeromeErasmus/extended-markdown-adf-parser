/**
 * @file Table Cell node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/tablecell/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, TableCellNode } from '../../../types';

/**
 * Table Cell Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/tablecell/
 * 
 * Purpose:
 * Table Cell nodes represent data cells in table rows
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "tableCell",
 *   "attrs": {
 *     "colspan": 1,
 *     "rowspan": 1,
 *     "colwidth": [120]
 *   },
 *   "content": [
 *     {
 *       "type": "paragraph",
 *       "content": [
 *         { "type": "text", "text": "Cell Data" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * 
 * Markdown Representation:
 * ```markdown
 * Cell Data (within table cell)
 * ```
 */
export class TableCellConverter implements NodeConverter {
  nodeType = 'tableCell';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const tableCellNode = node as TableCellNode;
    
    if (!tableCellNode.content || tableCellNode.content.length === 0) {
      return '';
    }

    // Convert content - typically paragraphs, but can contain other nodes
    const content = context.convertChildren(tableCellNode.content);
    
    // Handle multi-line content by replacing newlines with <br> for table compatibility
    // Escape literal pipes so they aren't read as extra column delimiters (issue #20)
    const cellContent = content.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
    
    // Handle colspan by duplicating content across cells (basic approach)
    const colspan = tableCellNode.attrs?.colspan || 1;
    if (colspan > 1) {
      // For now, just indicate colspan in content
      const result = cellContent + ` <!-- colspan=${colspan} -->`;
      
      // Add metadata for other custom attributes
      const customAttrs = { ...tableCellNode.attrs };
      delete (customAttrs as any).colspan;
      
      if (Object.keys(customAttrs).length > 0) {
        return `${result}<!-- adf:tableCell attrs='${JSON.stringify(customAttrs)}' -->`;
      }
      
      return result;
    }
    
    // Add metadata for custom attributes (rowspan, colwidth, etc.)
    if (tableCellNode.attrs && Object.keys(tableCellNode.attrs).length > 0) {
      return `${cellContent}<!-- adf:tableCell attrs='${JSON.stringify(tableCellNode.attrs)}' -->`;
    }
    
    return cellContent;
  }
}