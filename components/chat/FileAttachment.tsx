'use client'

import { File, X, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'

export interface AttachedFile {
  id: string
  name: string
  size: number
  type: string
  content?: string // Base64 for images, text content for code files
}

interface FileAttachmentProps {
  file: AttachedFile
  onRemove?: () => void
  showRemove?: boolean
}

export function FileAttachment({ file, onRemove, showRemove = true }: FileAttachmentProps) {
  const isImage = file.type.startsWith('image/')
  const [imageError, setImageError] = useState(false)

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] group hover:bg-white/[0.06] transition-colors">
      {isImage && file.content && !imageError ? (
        <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
          <img
            src={file.content}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded bg-[#5E6AD2]/10 flex items-center justify-center flex-shrink-0">
          {isImage ? (
            <ImageIcon className="w-5 h-5 text-[#5E6AD2]" />
          ) : (
            <File className="w-5 h-5 text-[#5E6AD2]" />
          )}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">{file.name}</p>
        <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
      </div>
      
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      )}
    </div>
  )
}

interface FileUploadProps {
  onFilesSelected: (files: AttachedFile[]) => void
  maxFiles?: number
  maxSize?: number // in MB
  accept?: string
}

export function FileUpload({ onFilesSelected, maxFiles = 5, maxSize = 10, accept }: FileUploadProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return
    
    // Validate file count
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }
    
    // Validate file sizes
    const maxSizeBytes = maxSize * 1024 * 1024
    const oversizedFiles = files.filter(f => f.size > maxSizeBytes)
    if (oversizedFiles.length > 0) {
      alert(`Files must be smaller than ${maxSize}MB`)
      return
    }
    
    // Process files
    const attachedFiles: AttachedFile[] = await Promise.all(
      files.map(async (file) => {
        const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Read file content for images and text files
        let content: string | undefined
        if (file.type.startsWith('image/')) {
          content = await readFileAsDataURL(file)
        } else if (file.type.startsWith('text/') || file.name.match(/\.(js|ts|tsx|jsx|py|java|cpp|c|h|css|html|json|md|txt)$/i)) {
          content = await readFileAsText(file)
        }
        
        return {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          content,
        }
      })
    )
    
    onFilesSelected(attachedFiles)
    
    // Reset input
    e.target.value = ''
  }
  
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }
  
  return (
    <input
      type="file"
      multiple
      accept={accept}
      onChange={handleFileChange}
      className="hidden"
      id="file-upload"
    />
  )
}
