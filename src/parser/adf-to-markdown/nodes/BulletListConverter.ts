/**
 * @file Bullet List node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/bulletlist/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, BulletListNode } from '../../../types';

/**
 * Bullet List Node Converter
 * 
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/bulletlist/
 * 
 * Purpose:
 * Bullet List nodes create unordered lists with bullet points
 * 
 * ADF Schema:
 * ```json
 * {
 *   "type": "bulletList",
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
 * - First item
 * - Second item
 * ```
 */
export class BulletListConverter implements NodeConverter {
  nodeType = 'bulletList';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const bulletListNode = node as BulletListNode;
    
    if (!bulletListNode.content || bulletListNode.content.length === 0) {
      return '';
    }

    const listItems = bulletListNode.content.map(listItem => {
      const itemConverter = context.options.registry?.getNodeConverter('listItem');
      if (itemConverter) {
        return itemConverter.toMarkdown(listItem, {
          ...context,
          depth: context.depth + 1,
          parent: bulletListNode,
          marker: '- ',
        });
      }
      return '';
    }).filter(item => item.length > 0);

    return listItems.join('\n');
  }
}