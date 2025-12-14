import { defineConfig } from 'tsup'

export default defineConfig([
  // Main entry point - CommonJS build
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    splitting: false, // CJS doesn't support splitting
    minify: false, // Keep readable for debugging
    outDir: 'dist',
    outExtension: () => ({ js: '.cjs', dts: '.d.cts' }),
    target: 'es2020',
    // Bundle ESM dependencies for CommonJS compatibility
    noExternal: [
      'unified',
      'remark',
      'remark-parse',
      'remark-stringify', 
      'remark-gfm',
      'remark-frontmatter',
      'micromark',
      'ajv',
      'ajv-formats'
    ]
  },

  // Main entry point - ESM build
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['esm'],
    dts: false, // Only generate types once
    clean: false, // Don't clean since CJS build runs first
    sourcemap: true,
    treeshake: true,
    splitting: true,
    minify: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    target: 'es2020',
    external: [
      'unified',
      'remark-parse',
      'remark-stringify', 
      'remark-gfm',
      'remark-frontmatter',
      'micromark',
      'ajv',
      'ajv-formats'
    ]
  },
  
  // Modular exports - CommonJS
  {
    entry: {
      streaming: 'src/parser/StreamingParser.ts',
      errors: 'src/errors/ErrorRecovery.ts'
    },
    format: ['cjs'],
    dts: true,
    clean: false, // Don't clean since main build runs first
    sourcemap: true,
    treeshake: true,
    splitting: false, // Keep modules separate
    minify: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.cjs', dts: '.d.cts' }),
    target: 'es2020',
    // Bundle ESM dependencies for CommonJS compatibility
    noExternal: [
      'unified',
      'remark',
      'remark-parse',
      'remark-stringify', 
      'remark-gfm',
      'remark-frontmatter',
      'micromark',
      'ajv',
      'ajv-formats'
    ]
  },

  // Modular exports - ESM
  {
    entry: {
      streaming: 'src/parser/StreamingParser.ts',
      errors: 'src/errors/ErrorRecovery.ts'
    },
    format: ['esm'],
    dts: false, // Only generate types once
    clean: false, // Don't clean since main build runs first
    sourcemap: true,
    treeshake: true,
    splitting: false, // Keep modules separate
    minify: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    target: 'es2020',
    external: [
      'unified',
      'remark-parse',
      'remark-stringify', 
      'remark-gfm',
      'remark-frontmatter',
      'micromark',
      'ajv',
      'ajv-formats'
    ]
  },
  
  // Test utilities (separate from main bundle)
  {
    entry: {
      'test-utils': 'src/utils/test-utils.ts'
    },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    treeshake: true,
    splitting: false,
    minify: false,
    outDir: 'dist',
    target: 'es2020'
  }
])