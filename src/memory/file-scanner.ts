/**
 * File Scanner and Metadata Extractor
 * 
 * This module provides functionality for:
 * - Recursive directory scanning
 * - File metadata extraction (path, language, size, hash)
 * - Code parsing to extract symbols and imports
 * 
 * Requirements: 1.1, 1.2
 */

import { createHash } from 'crypto';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { CodeFile, CodeChunk } from './types';

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Map of file extensions to programming languages
 */
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'shell',
  '.bash': 'shell',
  '.sql': 'sql',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
};

/**
 * Directories to ignore during scanning
 */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'venv',
  'env',
  '.venv',
  '.env',
]);

/**
 * File extensions to ignore
 */
const IGNORE_EXTENSIONS = new Set([
  '.lock',
  '.log',
  '.tmp',
  '.temp',
  '.swp',
  '.swo',
  '.bak',
  '.old',
  '.orig',
  '.min.js',
  '.min.css',
  '.map',
  '.d.ts.map',
  '.js.map',
]);

// ============================================================================
// File Scanner
// ============================================================================

export interface ScanOptions {
  /**
   * Maximum file size to process (in bytes)
   * Default: 1MB
   */
  maxFileSize?: number;
  
  /**
   * File extensions to include (if specified, only these will be scanned)
   */
  includeExtensions?: string[];
  
  /**
   * Additional directories to ignore
   */
  ignoreDirs?: string[];
  
  /**
   * Whether to follow symbolic links
   * Default: false
   */
  followSymlinks?: boolean;
}

export interface ScanResult {
  files: CodeFile[];
  errors: Array<{ path: string; error: string }>;
  stats: {
    totalFiles: number;
    totalSize: number;
    skippedFiles: number;
    errorFiles: number;
  };
}

/**
 * Recursively scan a directory and extract file metadata
 * 
 * @param repoPath Path to the repository root
 * @param options Scan options
 * @returns Scan results with file metadata
 */
export function scanDirectory(
  repoPath: string,
  options: ScanOptions = {}
): ScanResult {
  const {
    maxFileSize = 1024 * 1024, // 1MB default
    includeExtensions,
    ignoreDirs = [],
    followSymlinks = false,
  } = options;
  
  const files: CodeFile[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    skippedFiles: 0,
    errorFiles: 0,
  };
  
  const allIgnoreDirs = new Set([...IGNORE_DIRS, ...ignoreDirs]);
  
  /**
   * Recursively scan a directory
   */
  function scanDir(dirPath: string): void {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        try {
          // Skip symbolic links unless followSymlinks is true
          if (entry.isSymbolicLink() && !followSymlinks) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Skip ignored directories
            if (allIgnoreDirs.has(entry.name)) {
              continue;
            }
            
            // Recursively scan subdirectory
            scanDir(fullPath);
          } else if (entry.isFile()) {
            // Process file
            processFile(fullPath, repoPath);
          }
        } catch (error) {
          errors.push({
            path: fullPath,
            error: error instanceof Error ? error.message : String(error),
          });
          stats.errorFiles++;
        }
      }
    } catch (error) {
      errors.push({
        path: dirPath,
        error: error instanceof Error ? error.message : String(error),
      });
      stats.errorFiles++;
    }
  }
  
  /**
   * Process a single file
   */
  function processFile(filePath: string, repoRoot: string): void {
    const ext = extname(filePath);
    
    // Skip ignored extensions
    if (IGNORE_EXTENSIONS.has(ext)) {
      stats.skippedFiles++;
      return;
    }
    
    // Filter by included extensions if specified
    if (includeExtensions && !includeExtensions.includes(ext)) {
      stats.skippedFiles++;
      return;
    }
    
    // Get file stats
    const stat = statSync(filePath);
    
    // Skip files that are too large
    if (stat.size > maxFileSize) {
      stats.skippedFiles++;
      return;
    }
    
    // Skip empty files
    if (stat.size === 0) {
      stats.skippedFiles++;
      return;
    }
    
    // Extract metadata
    try {
      const metadata = extractFileMetadata(filePath, repoRoot);
      files.push(metadata);
      
      stats.totalFiles++;
      stats.totalSize += stat.size;
    } catch (error) {
      errors.push({
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      stats.errorFiles++;
    }
  }
  
  // Start scanning from the root
  scanDir(repoPath);
  
  return { files, errors, stats };
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract metadata for a single file
 * 
 * @param filePath Absolute path to the file
 * @param repoPath Repository root path
 * @returns File metadata
 */
export function extractFileMetadata(
  filePath: string,
  repoPath: string
): CodeFile {
  const stat = statSync(filePath);
  const content = readFileSync(filePath, 'utf-8');
  
  // Calculate SHA-256 hash of file content
  const hash = createHash('sha256').update(content).digest('hex');
  
  // Get relative path from repo root
  const relativePath = relative(repoPath, filePath);
  
  // Detect language from extension
  const ext = extname(filePath);
  const language = LANGUAGE_MAP[ext] || null;
  
  // Get repository name from path
  const repoName = basename(repoPath);
  
  return {
    path: relativePath,
    repo: repoName,
    hash,
    language,
    size: stat.size,
    last_modified: Math.floor(stat.mtimeMs),
  };
}

// ============================================================================
// Symbol and Import Extraction
// ============================================================================

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'let' | 'var' | 'enum';
  line: number;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  line: number;
}

/**
 * Extract symbols and imports from code
 * 
 * This is a simple regex-based parser that works for common patterns.
 * For production use, consider using language-specific parsers (e.g., TypeScript compiler API).
 * 
 * @param content File content
 * @param language Programming language
 * @returns Object with symbols and imports
 */
export function extractSymbolsAndImports(
  content: string,
  language: string | null
): { symbols: SymbolInfo[]; imports: ImportInfo[] } {
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  
  if (!language) {
    return { symbols, imports };
  }
  
  const lines = content.split('\n');
  
  switch (language) {
    case 'typescript':
    case 'javascript':
      extractTypeScriptSymbols(lines, symbols, imports);
      break;
    case 'python':
      extractPythonSymbols(lines, symbols, imports);
      break;
    case 'java':
      extractJavaSymbols(lines, symbols, imports);
      break;
    // Add more languages as needed
    default:
      // For unsupported languages, return empty arrays
      break;
  }
  
  return { symbols, imports };
}

/**
 * Extract symbols and imports from TypeScript/JavaScript code
 */
function extractTypeScriptSymbols(
  lines: string[],
  symbols: SymbolInfo[],
  imports: ImportInfo[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Extract imports
    const importMatch = line.match(/^import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      const source = importMatch[3];
      
      const importNames: string[] = [];
      if (namedImports) {
        importNames.push(...namedImports.split(',').map(s => s.trim()));
      }
      if (defaultImport) {
        importNames.push(defaultImport);
      }
      
      imports.push({
        source,
        imports: importNames,
        line: lineNum,
      });
    }
    
    // Extract function declarations
    const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: 'function',
        line: lineNum,
      });
    }
    
    // Extract arrow functions assigned to const/let/var
    const arrowMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[1],
        type: 'const',
        line: lineNum,
      });
    }
    
    // Extract class declarations
    const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        line: lineNum,
      });
    }
    
    // Extract interface declarations
    const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: lineNum,
      });
    }
    
    // Extract type declarations
    const typeMatch = line.match(/^(?:export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        type: 'type',
        line: lineNum,
      });
    }
    
    // Extract enum declarations
    const enumMatch = line.match(/^(?:export\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        type: 'enum',
        line: lineNum,
      });
    }
  }
}

/**
 * Extract symbols and imports from Python code
 */
function extractPythonSymbols(
  lines: string[],
  symbols: SymbolInfo[],
  imports: ImportInfo[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Extract imports
    const importMatch = line.match(/^import\s+(\w+(?:\s*,\s*\w+)*)/);
    if (importMatch) {
      const modules = importMatch[1].split(',').map(s => s.trim());
      imports.push({
        source: modules[0],
        imports: modules,
        line: lineNum,
      });
    }
    
    // Extract from imports
    const fromMatch = line.match(/^from\s+(\S+)\s+import\s+(.+)/);
    if (fromMatch) {
      const source = fromMatch[1];
      const importNames = fromMatch[2].split(',').map(s => s.trim());
      imports.push({
        source,
        imports: importNames,
        line: lineNum,
      });
    }
    
    // Extract function definitions
    const funcMatch = line.match(/^def\s+(\w+)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: 'function',
        line: lineNum,
      });
    }
    
    // Extract class definitions
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        line: lineNum,
      });
    }
  }
}

/**
 * Extract symbols and imports from Java code
 */
function extractJavaSymbols(
  lines: string[],
  symbols: SymbolInfo[],
  imports: ImportInfo[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Extract imports
    const importMatch = line.match(/^import\s+(?:static\s+)?([^;]+);/);
    if (importMatch) {
      const importPath = importMatch[1];
      const parts = importPath.split('.');
      const importName = parts[parts.length - 1];
      
      imports.push({
        source: importPath,
        imports: [importName],
        line: lineNum,
      });
    }
    
    // Extract class declarations
    const classMatch = line.match(/^(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        line: lineNum,
      });
    }
    
    // Extract interface declarations
    const interfaceMatch = line.match(/^(?:public\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: lineNum,
      });
    }
    
    // Extract enum declarations
    const enumMatch = line.match(/^(?:public\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        type: 'enum',
        line: lineNum,
      });
    }
    
    // Extract method declarations (simplified)
    const methodMatch = line.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/);
    if (methodMatch) {
      symbols.push({
        name: methodMatch[1],
        type: 'function',
        line: lineNum,
      });
    }
  }
}

// ============================================================================
// Note: Chunk Creation
// ============================================================================

/**
 * Chunk creation has been moved to chunker.ts (task 5.2)
 * Import createCodeChunks from './chunker' to use the full chunking system
 */
