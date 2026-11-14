/**
 * @file ADF (Atlassian Document Format) type definitions
 * @see https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
 */

export interface ADFDocument {
  version: number;
  type: 'doc';
  content: ADFNode[];
}

export interface ADFNode {
  type: string;
  attrs?: Record<string, any>;
  content?: ADFNode[];
  marks?: ADFMark[];
  text?: string;
}

export interface ADFMark {
  type: string;
  attrs?: Record<string, any>;
}

// Specific node types
export interface ParagraphNode extends ADFNode {
  type: 'paragraph';
  content?: ADFNode[];
}

export interface HeadingNode extends ADFNode {
  type: 'heading';
  attrs: {
    level: 1 | 2 | 3 | 4 | 5 | 6;
  };
  content?: ADFNode[];
}

export interface TextNode extends ADFNode {
  type: 'text';
  text: string;
  marks?: ADFMark[];
}

export interface PanelNode extends ADFNode {
  type: 'panel';
  attrs: {
    panelType: 'info' | 'warning' | 'error' | 'success' | 'note';
  };
  content?: ADFNode[];
}

export interface CodeBlockNode extends ADFNode {
  type: 'codeBlock';
  attrs?: {
    language?: string;
  };
  content?: TextNode[];
}

export interface BulletListNode extends ADFNode {
  type: 'bulletList';
  content: ListItemNode[];
}

export interface OrderedListNode extends ADFNode {
  type: 'orderedList';
  attrs?: {
    order?: number;
  };
  content: ListItemNode[];
}

export interface ListItemNode extends ADFNode {
  type: 'listItem';
  content?: ADFNode[];
}

export interface TaskListNode extends ADFNode {
  type: 'taskList';
  attrs: { localId: string };
  content: TaskItemNode[];
}

export interface TaskItemNode extends ADFNode {
  type: 'taskItem';
  attrs: { localId: string; state: 'TODO' | 'DONE' };
  content?: ADFNode[];  // inline nodes directly, no paragraph wrapper
}

export interface MediaNode extends ADFNode {
  type: 'media';
  attrs: {
    id: string;
    type: 'file' | 'link' | 'external';
    collection?: string;
    width?: number;
    height?: number;
    alt?: string;
  };
}

export interface MediaSingleNode extends ADFNode {
  type: 'mediaSingle';
  attrs?: {
    layout?: 'center' | 'wide' | 'full-width' | 'align-start' | 'align-end' | 'wrap-left' | 'wrap-right';
    width?: number;
  };
  content?: MediaNode[];
}

export interface ExpandNode extends ADFNode {
  type: 'expand' | 'nestedExpand';
  attrs?: {
    title?: string;
  };
  content?: ADFNode[];
}

export interface BlockquoteNode extends ADFNode {
  type: 'blockquote';
  content?: ADFNode[];
}

export interface TableNode extends ADFNode {
  type: 'table';
  attrs?: {
    isNumberColumnEnabled?: boolean;
    layout?: 'default' | 'full-width' | 'wide';
  };
  content: TableRowNode[];
}

export interface TableRowNode extends ADFNode {
  type: 'tableRow';
  content: (TableHeaderNode | TableCellNode)[];
}

export interface TableHeaderNode extends ADFNode {
  type: 'tableHeader';
  attrs?: {
    colspan?: number;
    rowspan?: number;
    colwidth?: number[];
  };
  content?: ADFNode[];
}

export interface TableCellNode extends ADFNode {
  type: 'tableCell';
  attrs?: {
    colspan?: number;
    rowspan?: number;
    colwidth?: number[];
  };
  content?: ADFNode[];
}

// Mark types
export interface StrongMark extends ADFMark {
  type: 'strong';
}

export interface EmMark extends ADFMark {
  type: 'em';
}

export interface CodeMark extends ADFMark {
  type: 'code';
}

export interface LinkMark extends ADFMark {
  type: 'link';
  attrs: {
    href: string;
    title?: string;
  };
}

export interface StrikeMark extends ADFMark {
  type: 'strike';
}

export interface UnderlineMark extends ADFMark {
  type: 'underline';
}

export interface TextColorMark extends ADFMark {
  type: 'textColor';
  attrs: {
    color: string;
  };
}

export interface BackgroundColorMark extends ADFMark {
  type: 'backgroundColor';
  attrs: {
    color: string;
  };
}

export interface SubSupMark extends ADFMark {
  type: 'subsup';
  attrs: {
    type: 'sub' | 'sup';
  };
}

export interface BorderMark extends ADFMark {
  type: 'border';
  attrs: {
    size: number;
    color: string;
  };
}

export interface FontSizeMark extends ADFMark {
  type: 'fontSize';
  attrs: {
    fontSize: string;
  };
}