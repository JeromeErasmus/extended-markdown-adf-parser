/**
 * @file List Item node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/listitem/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, ListItemNode } from '../../../types';

/**
 * List Item Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/listitem/
 * 
 * Purpose:
 * List Item nodes represent individual items within bullet or ordered lists
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "listItem",
 *   "content": [
 *     {
 *       "type": "paragraph",
 *       "content": [
 *         { "type": "text", "text": "Item content" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * 
 * Markdown Representation:
 * ```markdown
 * - Item content (for bullet lists)
 * 1. Item content (for ordered lists)
 * ```
 */
export class ListItemConverter implements NodeConverter {
  nodeType = 'listItem';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const listItemNode = node as ListItemNode;
    
    const marker = context.marker ?? '- ';

    if (!listItemNode.content || listItemNode.content.length === 0) {
      return marker;
    }

    // For list item content, we need block-level spacing between elements (paragraph + nested lists)
    const content = listItemNode.content.map(node => {
      const converter = context.options.registry?.getNodeConverter(node.type);
      if (!converter) return '';
      return converter.toMarkdown(node, context);
    }).filter(content => content.trim().length > 0).join('\n\n');

    // Continuation lines must indent to the marker's width (e.g. '5. ' is wider than '- ')
    // so nested content stays attached to this item under CommonMark list rules.
    const continuationIndent = ' '.repeat(marker.length);
    const lines = content.split('\n');
    const indentedLines = lines.map((line, index) => {
      if (index === 0) {
        return `${marker}${line}`;
      } else if (line.trim().length > 0) {
        return `${continuationIndent}${line}`;
      } else {
        return line; // Keep empty lines as-is
      }
    });
    
    // Add metadata for custom attributes if present
    if (listItemNode.attrs && Object.keys(listItemNode.attrs).length > 0) {
      const result = indentedLines.join('\n');
      return `${result}<!-- adf:listItem attrs='${JSON.stringify(listItemNode.attrs)}' -->`;
    }
    
    return indentedLines.join('\n');
  }
}