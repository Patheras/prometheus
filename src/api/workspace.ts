/**
 * Workspace API - File browsing and management
 */

import { Request, Response } from 'express'
import { scanDirectory, extractFileMetadata } from '../memory/file-scanner.js'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Get files for a repository or Prometheus itself
 */
export function handleGetFiles(req: Request, res: Response): any {
  try {
    const { repoId } = req.params
    
    // Determine which path to scan
    let scanPath: string
    if (repoId === 'self' || !repoId) {
      // Scan Prometheus's own codebase
      scanPath = process.cwd()
    } else {
      // TODO: Get repository path from database
      // For now, return mock data
      return res.json({
        files: [
          { name: 'src/', type: 'folder', files: 89, path: 'src' },
          { name: 'tests/', type: 'folder', files: 24, path: 'tests' },
          { name: 'docs/', type: 'folder', files: 12, path: 'docs' },
          { name: 'README.md', type: 'file', size: '8.4 KB', path: 'README.md' },
          { name: 'package.json', type: 'file', size: '1.8 KB', path: 'package.json' },
        ],
        stats: {
          totalFiles: 125,
          codeFiles: 89,
          lastScan: Date.now() - 120000,
        },
      })
    }
    
    // Scan directory
    const result = scanDirectory(scanPath, {
      maxFileSize: 1024 * 1024, // 1MB
      includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
    })
    
    // Group files by directory
    const fileTree: Record<string, any> = {}
    
    for (const file of result.files) {
      const parts = file.path.split('/')
      let current = fileTree
      
      for (let i = 0; i < parts.length - 1; i++) {
        const dir = parts[i]!
        if (!current[dir]) {
          current[dir] = { type: 'folder', children: {}, files: 0 }
        }
        current[dir].files++
        current = current[dir].children
      }
      
      const fileName = parts[parts.length - 1]!
      current[fileName] = {
        type: 'file',
        size: file.size,
        language: file.language,
        path: file.path,
      }
    }
    
    // Convert to array format
    const files = Object.entries(fileTree).map(([name, data]: [string, any]) => ({
      name: data.type === 'folder' ? `${name}/` : name,
      type: data.type,
      files: data.files,
      size: data.size ? formatFileSize(data.size) : undefined,
      path: name,
    }))
    
    res.json({
      files,
      stats: {
        totalFiles: result.stats.totalFiles,
        codeFiles: result.files.filter(f => f.language).length,
        lastScan: Date.now(),
      },
    })
  } catch (error) {
    console.error('Get files error:', error)
    res.status(500).json({
      error: 'Failed to get files',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Get file content
 */
export function handleGetFileContent(req: Request, res: Response): any {
  try {
    const { repoId, filePath } = req.params
    
    let fullPath: string
    if (repoId === 'self' || !repoId) {
      fullPath = join(process.cwd(), filePath as string)
    } else {
      // TODO: Get repository path from database
      return res.status(404).json({ error: 'Repository not found' })
    }
    
    const content = readFileSync(fullPath, 'utf-8')
    const metadata = extractFileMetadata(fullPath, process.cwd())
    
    res.json({
      content,
      metadata,
    })
  } catch (error) {
    console.error('Get file content error:', error)
    res.status(500).json({
      error: 'Failed to get file content',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
