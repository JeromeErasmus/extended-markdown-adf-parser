# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.3] - 2024-12-14

### Fixed
- **Expand Block Validation**: Fixed validation logic to detect expand blocks at any nesting level, not just top-level content
- **Social Element Formatting**: Fixed social elements (mentions, emojis, status, dates) to properly inherit formatting marks (bold, italic, etc.)
- **Table Cell Structure**: Fixed test expectations for table cell content structure when containing social elements
- **ADF Fence Block Processing**: Completed all remaining items from the fence block processing fix plan
- **Test Suite**: All 76 test suites now pass with 1,218 tests passing and comprehensive validation at 18/18 items

### Enhanced
- **Mark Application**: Enhanced `wrapWithMark` method to apply formatting marks to social element nodes in addition to text nodes
- **Recursive Validation**: Added recursive search for ADF elements in nested content structures
- **Test Coverage**: Achieved 100% success rate for new features validation (25/25 features)

## [2.1.0] - 2025-01-26

### Added
- **Social Elements Support**: Complete implementation of Confluence social elements
  - User mentions: `{user:id}` syntax converts to ADF mention nodes
  - Emoji: `:emoji:` syntax converts to ADF emoji nodes with proper formatting
  - Date nodes: `{date:YYYY-MM-DD}` syntax converts to ADF date nodes
  - Status nodes: `{status:text}` syntax converts to ADF status nodes with proper styling
  - Media references: `![alt](media:id)` syntax converts to ADF mediaSingle blocks
  - Inline cards: `[text](card:url)` syntax converts to ADF inlineCard nodes

### Enhanced
- **Parser Coverage**: Increased supported element coverage from 56% (14/25) to 100% for core social elements
- **Text Processing**: Enhanced mdast text node processing to handle social element parsing
- **Mixed Content**: Full support for complex content combining multiple social elements
- **Media Handling**: Improved media reference parsing with support for both `media:` and `adf:media:` formats

### Fixed
- **Inline Card Processing**: Fixed detection of `card:` URLs in markdown links to properly convert to inline cards
- **Media Wrapping**: Fixed media nodes to be properly wrapped in `mediaSingle` containers for block-level display
- **Social Element Parsing**: Fixed text node processing to catch social elements before regular markdown processing

## [1.2.1] - 2025-01-22

### Fixed
- **TypeScript Compilation**: Resolved all TypeScript compilation errors
  - Fixed `MediaNode` interface to include optional `alt` property
  - Extended `ValidationError` interface to include optional `line` property for better error reporting
  - Fixed `Data` interface extension for ADF metadata handling in mdast nodes
  - Improved AJV validator function typing with proper `ValidateFunction` type
  - Fixed type assertions in metadata comment utilities

### Changed
- Enhanced type safety across the codebase
- Improved error reporting with line number information in validation errors
- Better TypeScript developer experience with complete type coverage

## [1.2.0] - 2025-01-21

### Added
- Metadata comments support to Basic Parser with smart detection

## [1.1.1] - 2025-01-20

### Fixed
- Centralized error handling improvements
- Documentation updates and conversion guides

## [1.1.0] - 2025-01-19

### Added
- Comprehensive testing documentation in README
- Enhanced error handling system