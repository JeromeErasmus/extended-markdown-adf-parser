/**
 * @file Task List node converter
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/taskList/
 */

import type { NodeConverter, ConversionContext } from '../../types';
import type { ADFNode, TaskListNode } from '../../../types';

/**
 * Task List Node Converter
 *
 * Official Documentation:
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/taskList/
 *
 * Purpose:
 * Task List nodes create checkbox task lists with TODO/DONE states
 *
 * ADF Schema:
 * ```json
 * {
 *   "type": "taskList",
 *   "attrs": { "localId": "unique-id" },
 *   "content": [
 *     {
 *       "type": "taskItem",
 *       "attrs": { "localId": "unique-id-1", "state": "DONE" },
 *       "content": [{ "type": "text", "text": "Completed task" }]
 *     }
 *   ]
 * }
 * ```
 *
 * Markdown Representation:
 * ```markdown
 * - [x] Completed task
 * - [ ] Pending task
 * ```
 */
export class TaskListConverter implements NodeConverter {
  nodeType = 'taskList';

  toMarkdown(node: ADFNode, context: ConversionContext): string {
    const taskListNode = node as TaskListNode;

    if (!taskListNode.content || taskListNode.content.length === 0) {
      return '';
    }

    const taskItems = taskListNode.content.map(taskItem => {
      const itemConverter = context.options.registry?.getNodeConverter('taskItem');
      if (itemConverter) {
        return itemConverter.toMarkdown(taskItem, {
          ...context,
          depth: context.depth + 1,
          parent: taskListNode
        });
      }
      return '';
    }).filter(item => item.length > 0);

    return taskItems.join('\n');
  }
}
