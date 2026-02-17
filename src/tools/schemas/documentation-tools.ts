/**
 * Documentation Tool Schemas
 * 
 * Tool schemas for documentation management.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Update Documentation Tool Schema
 * Maps to: File system write (restricted to .md files)
 */
export const updateDocumentationSchema: ToolSchema = {
  name: 'update_documentation',
  description: 'Update or create documentation files (.md only). Use this to update API documentation, README files, or create new documentation. This tool can only write to markdown files for safety. Provide the complete new content for the file.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the documentation file (must end with .md). Examples: "API.md", "docs/function-calling.md", "README.md"',
      },
      content: {
        type: 'string',
        description: 'Complete content to write to the file. Use proper markdown formatting.',
      },
      createIfNotExists: {
        type: 'boolean',
        description: 'Create the file if it does not exist. Default: true',
      },
    },
    required: ['filePath', 'content'],
  },
};

/**
 * Execute documentation update
 */
export async function executeUpdateDocumentation(
  args: { filePath: string; content: string; createIfNotExists?: boolean },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // Security: Only allow .md files
    if (!args.filePath.endsWith('.md')) {
      return {
        success: false,
        error: 'Security restriction: Can only write to .md (markdown) files',
        executionTime: Date.now() - startTime,
      };
    }

    // Security: Prevent path traversal
    if (args.filePath.includes('..')) {
      return {
        success: false,
        error: 'Security restriction: Path traversal not allowed',
        executionTime: Date.now() - startTime,
      };
    }

    // Resolve full path
    const fullPath = path.resolve(process.cwd(), args.filePath);

    // Check if path is within project directory
    if (!fullPath.startsWith(process.cwd())) {
      return {
        success: false,
        error: 'Security restriction: Can only write files within project directory',
        executionTime: Date.now() - startTime,
      };
    }

    // Check if file exists
    const fileExists = fs.existsSync(fullPath);
    const createIfNotExists = args.createIfNotExists !== false; // Default true

    if (!fileExists && !createIfNotExists) {
      return {
        success: false,
        error: `File does not exist: ${args.filePath}`,
        executionTime: Date.now() - startTime,
      };
    }

    // Create directory if needed
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Backup existing file if it exists
    let backupPath: string | null = null;
    if (fileExists) {
      backupPath = `${fullPath}.backup.${Date.now()}`;
      fs.copyFileSync(fullPath, backupPath);
    }

    // Write file
    fs.writeFileSync(fullPath, args.content, 'utf-8');

    return {
      success: true,
      result: {
        filePath: args.filePath,
        fullPath,
        action: fileExists ? 'updated' : 'created',
        backupPath,
        size: args.content.length,
      },
      executionTime: Date.now() - startTime,
      metadata: {
        endpoint: 'filesystem',
        operation: 'write',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during documentation update',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * List Documentation Files Tool Schema
 */
export const listDocumentationSchema: ToolSchema = {
  name: 'list_documentation',
  description: 'List all documentation files (.md) in the project. Use this to discover what documentation exists before updating.',
  parameters: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to search (default: project root). Examples: ".", "docs", "src"',
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively in subdirectories. Default: true',
      },
    },
    required: [],
  },
};

/**
 * Execute list documentation
 */
export async function executeListDocumentation(
  args: { directory?: string; recursive?: boolean },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const directory = args.directory || '.';
    const recursive = args.recursive !== false; // Default true

    // Security: Prevent path traversal
    if (directory.includes('..')) {
      return {
        success: false,
        error: 'Security restriction: Path traversal not allowed',
        executionTime: Date.now() - startTime,
      };
    }

    // Resolve full path
    const fullPath = path.resolve(process.cwd(), directory);

    // Check if path is within project directory
    if (!fullPath.startsWith(process.cwd())) {
      return {
        success: false,
        error: 'Security restriction: Can only list files within project directory',
        executionTime: Date.now() - startTime,
      };
    }

    // Check if directory exists
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `Directory does not exist: ${directory}`,
        executionTime: Date.now() - startTime,
      };
    }

    // List markdown files
    const markdownFiles: Array<{
      path: string;
      size: number;
      modified: number;
    }> = [];

    function scanDirectory(dir: string, baseDir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullEntryPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullEntryPath);

        // Skip node_modules, .git, dist, etc.
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.next') {
          continue;
        }

        if (entry.isDirectory() && recursive) {
          scanDirectory(fullEntryPath, baseDir);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const stats = fs.statSync(fullEntryPath);
          markdownFiles.push({
            path: relativePath.replace(/\\/g, '/'), // Normalize path separators
            size: stats.size,
            modified: stats.mtimeMs,
          });
        }
      }
    }

    scanDirectory(fullPath, process.cwd());

    // Sort by path
    markdownFiles.sort((a, b) => a.path.localeCompare(b.path));

    return {
      success: true,
      result: {
        directory,
        totalFiles: markdownFiles.length,
        files: markdownFiles,
      },
      executionTime: Date.now() - startTime,
      metadata: {
        endpoint: 'filesystem',
        operation: 'list',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during documentation listing',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Documentation tool definitions
 */
export const documentationTools: ToolDefinition[] = [
  {
    schema: updateDocumentationSchema,
    executor: executeUpdateDocumentation,
    category: 'documentation',
  },
  {
    schema: listDocumentationSchema,
    executor: executeListDocumentation,
    category: 'documentation',
  },
];
