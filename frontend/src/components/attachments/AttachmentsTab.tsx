import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  MoreHorizontal,
  FileText,
  Image,
  File,
  Calendar,
  User
} from 'lucide-react'
import { toast } from 'sonner'
import { apiService } from '../../services/api'

interface Attachment {
  id: number
  file_name: string
  original_name: string
  file_type: string
  file_size: number
  uploaded_at: string
  description?: string
  uploaded_by_name?: string
  version: number
}

interface AttachmentsTabProps {
  entityType: 'repair_ticket' | 'warranty_repair_ticket' | 'work_order' | 'warranty_work_order'
  entityId: string
}

export function AttachmentsTab({ entityType, entityId }: AttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadAttachments()
  }, [entityType, entityId])

  const loadAttachments = async () => {
    setLoading(true)
    try {
      const data = await apiService.getAttachments(entityType, entityId)
      setAttachments(data)
    } catch (error) {
      console.error('Error loading attachments:', error)
      toast.error('Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    setUploading(true)
    try {
      await apiService.uploadAttachments(entityType, entityId, selectedFiles, description)
      toast.success(`Successfully uploaded ${selectedFiles.length} file(s)`)
      setSelectedFiles([])
      setDescription('')
      // Clear the file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      loadAttachments()
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await apiService.downloadAttachment(attachment.id.toString())
      
      // Create a proper download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.original_name
      link.style.display = 'none'
      
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)
      
      toast.success(`Downloaded ${attachment.original_name}`)
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Are you sure you want to delete "${attachment.original_name}"?`)) {
      return
    }

    try {
      await apiService.deleteAttachment(attachment.id.toString())
      toast.success('File deleted successfully')
      loadAttachments()
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file')
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-4 w-4" />
    } else {
      return <File className="h-4 w-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              className="mb-2"
            />
            <p className="text-sm text-muted-foreground">
              Supported formats: Images, PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR (Max 50MB per file)
            </p>
          </div>
          
          <div>
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Selected files:</p>
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    • {file.name} ({formatFileSize(file.size)})
                  </div>
                ))}
              </div>
            </div>
          )}

              <Button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="w-auto px-4"
              >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
          </Button>
        </CardContent>
      </Card>

      {/* Attachments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Attachments ({attachments.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading attachments...</div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attachments yet</p>
              <p className="text-sm">Upload files using the form above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(attachment.file_type)}
                        <div>
                          <div className="font-medium">{attachment.original_name}</div>
                          {attachment.description && (
                            <div className="text-sm text-muted-foreground">
                              {attachment.description}
                            </div>
                          )}
                          {attachment.version > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              v{attachment.version}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(attachment.file_size)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(attachment.uploaded_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        {attachment.uploaded_by_name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleDownload(attachment)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(attachment)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
