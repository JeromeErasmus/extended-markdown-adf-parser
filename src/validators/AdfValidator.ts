/**
 * @file ADF document validator
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ADFDocument, ValidationResult } from '../types';
import adfSchema from './schemas/adf-schema.json';

export class AdfValidator {
  private ajv: Ajv;
  private validateAdf: ValidateFunction;
  
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false // Allow additional properties for extensibility
    });
    
    // Add format validators (uri, etc.)
    addFormats(this.ajv);
    
    this.registerSchemas();
    this.validateAdf = this.ajv.compile(adfSchema);
  }
  
  validate(adf: unknown): ValidationResult {
    // JSON Schema validation
    const isValid = this.validateAdf(adf);
    
    if (!isValid) {
      const errors = (this.validateAdf.errors || []).map(error => ({
        message: `${error.instancePath || 'root'} ${error.message || 'Validation error'}`,
        code: 'SCHEMA_VALIDATION_ERROR',
        path: error.instancePath
      }));
      
      return {
        valid: false,
        errors
      };
    }
    
    // Additional semantic validation
    const semanticErrors = this.validateSemantics(adf as ADFDocument);
    
    return {
      valid: semanticErrors.length === 0,
      errors: semanticErrors
    };
  }
  
  isValidAdf(content: unknown): content is ADFDocument {
    return this.isValidAdfStructure(content);
  }
  
  private isValidAdfStructure(content: unknown): content is ADFDocument {
    if (typeof content !== 'object' || content === null) {
      return false;
    }
    
    const doc = content as any;
    return doc.type === 'doc' && Array.isArray(doc.content) && typeof doc.version === 'number';
  }
  
  private validateSemantics(adf: ADFDocument): Array<{message: string; code: string; path?: string}> {
    const errors: Array<{message: string; code: string; path?: string}> = [];
    
    // Validate document structure
    if (adf.version !== 1) {
      errors.push({
        message: `Unsupported ADF version: ${adf.version}. Expected version 1.`,
        code: 'UNSUPPORTED_VERSION'
      });
    }
    
    // Validate content nodes
    this.validateContentNodes(adf.content, '', errors);
    
    return errors;
  }
  
  private validateContentNodes(
    nodes: any[], 
    path: string, 
    errors: Array<{message: string; code: string; path?: string}>
  ): void {
    nodes.forEach((node, index) => {
      const nodePath = `${path}/content[${index}]`;
      
      // Validate required fields
      if (!node.type) {
        errors.push({
          message: 'Node missing required "type" field',
          code: 'MISSING_NODE_TYPE',
          path: nodePath
        });
        return;
      }
      
      // Validate text nodes have text content
      if (node.type === 'text' && typeof node.text !== 'string') {
        errors.push({
          message: 'Text node must have "text" property with string value',
          code: 'INVALID_TEXT_NODE',
          path: nodePath
        });
      }
      
      // Validate heading level
      if (node.type === 'heading') {
        const level = node.attrs?.level;
        if (typeof level !== 'number' || level < 1 || level > 6) {
          errors.push({
            message: 'Heading node must have level between 1 and 6',
            code: 'INVALID_HEADING_LEVEL',
            path: nodePath
          });
        }
      }
      
      // Validate panel type
      if (node.type === 'panel') {
        const panelType = node.attrs?.panelType;
        if (!panelType || !['info', 'warning', 'error', 'success', 'note'].includes(panelType)) {
          errors.push({
            message: 'Panel node must have valid panelType (info, warning, error, success, note)',
            code: 'INVALID_PANEL_TYPE',
            path: nodePath
          });
        }
      }
      
      // Validate ordered list attributes
      if (node.type === 'orderedList' && node.attrs?.order) {
        const order = node.attrs.order;
        if (typeof order !== 'number' || order < 1) {
          errors.push({
            message: 'OrderedList order attribute must be a positive number',
            code: 'INVALID_LIST_ORDER',
            path: nodePath
          });
        }
      }
      
      // Recursively validate child content
      if (node.content && Array.isArray(node.content)) {
        this.validateContentNodes(node.content, nodePath, errors);
      }
      
      // Validate marks
      if (node.marks && Array.isArray(node.marks)) {
        this.validateMarks(node.marks, nodePath, errors);
      }
    });
  }
  
  private validateMarks(
    marks: any[], 
    path: string, 
    errors: Array<{message: string; code: string; path?: string}>
  ): void {
    marks.forEach((mark, index) => {
      const markPath = `${path}/marks[${index}]`;
      
      if (!mark.type) {
        errors.push({
          message: 'Mark missing required "type" field',
          code: 'MISSING_MARK_TYPE',
          path: markPath
        });
        return;
      }
      
      // Validate link mark
      if (mark.type === 'link') {
        const href = mark.attrs?.href;
        if (!href || typeof href !== 'string') {
          errors.push({
            message: 'Link mark must have href attribute with URL',
            code: 'INVALID_LINK_HREF',
            path: markPath
          });
        }
      }
      
      // Validate text color mark
      if (mark.type === 'textColor') {
        const color = mark.attrs?.color;
        if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          errors.push({
            message: 'TextColor mark must have valid hex color (e.g., #FF0000)',
            code: 'INVALID_TEXT_COLOR',
            path: markPath
          });
        }
      }

      // Validate border mark (applied to media/mediaSingle nodes)
      if (mark.type === 'border') {
        const color = mark.attrs?.color;
        if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
          errors.push({
            message: 'Border mark must have valid hex color (e.g., #091E4224)',
            code: 'INVALID_BORDER_COLOR',
            path: markPath
          });
        }

        const size = mark.attrs?.size;
        if (typeof size !== 'number' || size < 0 || size > 3) {
          errors.push({
            message: 'Border mark must have a size attribute between 0 and 3',
            code: 'INVALID_BORDER_SIZE',
            path: markPath
          });
        }
      }
    });
  }
  
  private registerSchemas(): void {
    // Schemas are loaded directly via imports
    // Additional schemas can be registered here if needed
  }
}