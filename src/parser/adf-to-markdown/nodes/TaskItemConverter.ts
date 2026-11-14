/**
 * @file Task Item node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/taskItem/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, TaskItemNode } from '../../../types';

/**
 * Task Item Node Converter
 *
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/taskItem/
 *
 * Purpose:
 * Task Item nodes represent individual checkbox items within a task list
 *
 * ADF Schema:
 * ```json
 * {
 *   "type": "taskItem",
 *   "attrs": { "localId": "unique-id", "state": "DONE" },
 *   "content": [
 *     { "type": "text", "text": "Task content" }
 *   ]
 * }
 * ```
 *
 * Markdown Representation:
 * ```markdown
 * - [x] Task content (for DONE)
 * - [ ] Task content (for TODO)
 * ```
 */
export class TaskItemConverter implements NodeConverter {
  nodeType = 'taskItem';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const taskItemNode = node as TaskItemNode;

    const prefix = taskItemNode.attrs?.state === 'DONE' ? '- [x] ' : '- [ ] ';

    if (!taskItemNode.content || taskItemNode.content.length === 0) {
      return prefix;
    }

    // taskItem has inline nodes directly (not paragraph-wrapped)
    const content = taskItemNode.content.map(child => {
      const converter = context.options.registry?.getNodeConverter(child.type);
      if (!converter) return '';
      return converter.toMarkdown(child, context);
    }).filter(c => c.length > 0).join('');

    // Handle multi-line content with 6-space indentation (aligns with content after '- [x] ')
    const lines = content.split('\n');
    const indentedLines = lines.map((line, index) => {
      if (index === 0) {
        return `${prefix}${line}`;
      } else if (line.trim().length > 0) {
        return `      ${line}`; // 6-space indent for continuation
      } else {
        return line; // Keep empty lines as-is
      }
    });

    return indentedLines.join('\n');
  }
}
