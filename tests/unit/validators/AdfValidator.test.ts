/**
 * @file Tests for AdfValidator with comprehensive schema validation
 */

import { AdfValidator } from '../../../src/validators/AdfValidator.js';
import type { ADFDocument } from '../../../src/types/adf.types.js';

describe('AdfValidator', () => {
  let validator: AdfValidator;

  beforeEach(() => {
    validator = new AdfValidator();
  });

  describe('Basic Structure Validation', () => {
    it('should validate valid ADF document', () => {
      const validAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello World' }
            ]
          }
        ]
      };

      const result = validator.validate(validAdf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document without version', () => {
      const invalidAdf = {
        type: 'doc',
        content: []
      };

      const result = validator.validate(invalidAdf);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject document with wrong type', () => {
      const invalidAdf = {
        version: 1,
        type: 'paragraph',
        content: []
      };

      const result = validator.validate(invalidAdf);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject document without content array', () => {
      const invalidAdf = {
        version: 1,
        type: 'doc'
      };

      const result = validator.validate(invalidAdf);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject non-object input', () => {
      const result = validator.validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject null input', () => {
      const result = validator.validate(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Version Validation', () => {
    it('should accept version 1', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: []
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported version', () => {
      const adf = {
        version: 2,
        type: 'doc',
        content: []
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('must be equal to constant')
        })
      );
    });
  });

  describe('Node Type Validation', () => {
    it('should accept valid node types', () => {
      const validNodes = [
        { type: 'paragraph', content: [] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'text', text: 'Some text' },
        { type: 'codeBlock', content: [{ type: 'text', text: 'code' }] },
        { type: 'panel', attrs: { panelType: 'info' }, content: [] },
        { type: 'expand', content: [] },
        { type: 'bulletList', content: [] },
        { type: 'orderedList', content: [] },
        { type: 'listItem', content: [] },
        { type: 'table', content: [] },
        { type: 'tableRow', content: [] },
        { type: 'tableHeader', content: [] },
        { type: 'tableCell', content: [] },
        { type: 'mediaSingle', content: [] },
        { type: 'media', attrs: { id: '123', type: 'file' } },
        { type: 'blockquote', content: [] },
        { type: 'rule' },
        { type: 'hardBreak' }
      ];

      validNodes.forEach(node => {
        const adf: ADFDocument = {
          version: 1,
          type: 'doc',
          content: [node]
        };

        const result = validator.validate(adf);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject nodes without type', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{}]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('must have required property \'type\'')
        })
      );
    });
  });

  describe('Heading Validation', () => {
    it('should validate heading with valid level', () => {
      for (let level = 1; level <= 6; level++) {
        const adf: ADFDocument = {
          version: 1,
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level },
            content: [{ type: 'text', text: `Level ${level}` }]
          }]
        };

        const result = validator.validate(adf);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject heading with invalid level', () => {
      const invalidLevels = [0, 7, -1, 10];

      invalidLevels.forEach(level => {
        const adf = {
          version: 1,
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level },
            content: [{ type: 'text', text: 'Invalid' }]
          }]
        };

        const result = validator.validate(adf);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'SCHEMA_VALIDATION_ERROR',
            message: expect.stringMatching(/level.*must be.*[<=|>=].*[1-6]/)
          })
        );
      });
    });

    it('should reject heading without level', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'heading',
          content: [{ type: 'text', text: 'No level' }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
    });
  });

  describe('Panel Validation', () => {
    it('should validate panel with valid type', () => {
      const validPanelTypes = ['info', 'warning', 'error', 'success', 'note'];

      validPanelTypes.forEach(panelType => {
        const adf: ADFDocument = {
          version: 1,
          type: 'doc',
          content: [{
            type: 'panel',
            attrs: { panelType },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Panel content' }]
              }
            ]
          }]
        };

        const result = validator.validate(adf);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject panel with invalid type', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'panel',
          attrs: { panelType: 'invalid' },
          content: []
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('must be equal to one of the allowed values')
        })
      );
    });

    it('should reject panel without type', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'panel',
          content: []
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
    });
  });

  describe('Text Node Validation', () => {
    it('should validate text node with text property', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should accept empty text', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: '' }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should reject text node without text property', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text' }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('must have required property \'text\'')
        })
      );
    });
  });

  describe('List Validation', () => {
    it('should validate ordered list with valid order', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'orderedList',
          attrs: { order: 5 },
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 5' }]
                }
              ]
            }
          ]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should reject ordered list with invalid order', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'orderedList',
          attrs: { order: 0 },
          content: []
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('order must be >= 1')
        })
      );
    });
  });

  describe('Mark Validation', () => {
    it('should validate link mark with href', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Link text',
            marks: [{
              type: 'link',
              attrs: { href: 'https://example.com' }
            }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should reject link mark without href', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Link text',
            marks: [{ type: 'link' }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_LINK_HREF'
        })
      );
    });

    it('should validate textColor mark with valid color', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Colored text',
            marks: [{
              type: 'textColor',
              attrs: { color: '#FF0000' }
            }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should reject textColor mark with invalid color', () => {
      const invalidColors = ['red', '#FF', '#GGGGGG', 'invalid'];

      invalidColors.forEach(color => {
        const adf = {
          version: 1,
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Colored text',
              marks: [{
                type: 'textColor',
                attrs: { color }
              }]
            }]
          }]
        };

        const result = validator.validate(adf);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'SCHEMA_VALIDATION_ERROR',
            message: expect.stringContaining('must match pattern')
          })
        );
      });
    });

    // border is a standard ADF mark applied to media/mediaSingle nodes -
    // it's what Jira attaches to a pasted image rendered with a border/frame.
    // It was missing from the mark type enum, so real Jira Cloud content
    // using it failed validateAdf() (regression for #15).
    it('should validate border mark on media node', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'mediaSingle',
          attrs: { layout: 'center' },
          content: [{
            type: 'media',
            attrs: { type: 'file', id: 'f2cf579e-2f68-43d2-9ad3-956028d437e1', collection: '' },
            marks: [{
              type: 'border',
              attrs: { size: 2, color: '#091e4224' }
            }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject border mark with invalid color', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'mediaSingle',
          content: [{
            type: 'media',
            attrs: { type: 'file', id: '123', collection: '' },
            marks: [{
              type: 'border',
              attrs: { size: 2, color: 'not-a-color' }
            }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('must match pattern')
        })
      );
    });

    it('should reject border mark without attrs', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'mediaSingle',
          content: [{
            type: 'media',
            attrs: { type: 'file', id: '123', collection: '' },
            marks: [{ type: 'border' }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_BORDER_COLOR'
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_BORDER_SIZE'
        })
      );
    });
  });

  describe('Nested Content Validation', () => {
    it('should validate deeply nested structures', () => {
      const adf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'panel',
          attrs: { panelType: 'info' },
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Nested content' }]
              }]
            }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(true);
    });

    it('should detect errors in nested structures', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [{
          type: 'panel',
          attrs: { panelType: 'info' },
          content: [{
            type: 'heading',
            attrs: { level: 10 }, // Invalid level
            content: [{ type: 'text', text: 'Invalid heading' }]
          }]
        }]
      };

      const result = validator.validate(adf);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('level must be <= 6')
        })
      );
    });
  });

  describe('isValidAdf Type Guard', () => {
    it('should return true for valid ADF', () => {
      const validAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: []
      };

      expect(validator.isValidAdf(validAdf)).toBe(true);
    });

    it('should return false for invalid structures', () => {
      expect(validator.isValidAdf(null)).toBe(false);
      expect(validator.isValidAdf('string')).toBe(false);
      expect(validator.isValidAdf({})).toBe(false);
      expect(validator.isValidAdf({ type: 'doc' })).toBe(false);
      expect(validator.isValidAdf({ type: 'paragraph', content: [] })).toBe(false);
    });
  });

  describe('Complex Document Validation', () => {
    it('should validate document with all node types', () => {
      const complexAdf: ADFDocument = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Text with ' },
              { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
              { type: 'text', text: ' and ' },
              { 
                type: 'text', 
                text: 'link', 
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] 
              }
            ]
          },
          {
            type: 'panel',
            attrs: { panelType: 'warning' },
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Warning message' }]
            }]
          },
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'console.log("hello");' }]
          },
          {
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'List item' }]
              }]
            }]
          },
          { type: 'rule' }
        ]
      };

      const result = validator.validate(complexAdf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});