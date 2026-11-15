/**
 * @file Ordered List node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/orderedlist/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, OrderedListNode } from '../../../types';

/**
 * Ordered List Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/orderedlist/
 * 
 * Purpose:
 * Ordered List nodes create numbered lists with sequential numbering
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "orderedList",
 *   "attrs": {
 *     "order": 1
 *   },
 *   "content": [
 *     {
 *       "type": "listItem",
 *       "content": [
 *         { "type": "paragraph", "content": [...] }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * 
 * Markdown Representation:
 * ```markdown
 * 1. First item
 * 2. Second item
 * ```
 */
export class OrderedListConverter implements NodeConverter {
  nodeType = 'orderedList';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const orderedListNode = node as OrderedListNode;
    
    if (!orderedListNode.content || orderedListNode.content.length === 0) {
      return '';
    }

    const startOrder = orderedListNode.attrs?.order || 1;
    
    const listItems = orderedListNode.content.map((listItem, index) => {
      const itemConverter = context.options.registry?.getNodeConverter('listItem');
      if (itemConverter) {
        const number = startOrder + index;
        return itemConverter.toMarkdown(listItem, {
          ...context,
          depth: context.depth + 1,
          parent: orderedListNode,
          marker: `${number}. `,
        });
      }
      return '';
    }).filter(item => item.length > 0);

    // Add metadata for custom attributes beyond order
    const customAttrs = { ...orderedListNode.attrs };
    if ('order' in customAttrs) {
      delete (customAttrs as any).order;
    }
    
    let result = listItems.join('\n');
    
    if (Object.keys(customAttrs).length > 0) {
      result += `<!-- adf:orderedList attrs='${JSON.stringify(customAttrs)}' -->`;
    }
    
    return result;
  }
}