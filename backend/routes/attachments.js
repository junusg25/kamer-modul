const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { entityType, entityId } = req.params;
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      const uploadDir = path.join(__dirname, '../uploads/attachments', year, month, entityType);
      
      // Create directory if it doesn't exist
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: async (req, file, cb) => {
    try {
      const { entityType, entityId } = req.params;
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Generate file name based on entity type and ID
      let prefix;
      switch (entityType) {
        case 'repair_ticket':
          prefix = 'tk';
          break;
        case 'warranty_repair_ticket':
          prefix = 'wtk';
          break;
        case 'work_order':
          prefix = 'wo';
          break;
        case 'warranty_work_order':
          prefix = 'wwo';
          break;
        default:
          prefix = 'att';
      }
      
      // Check if file already exists and increment version
      const baseName = `${prefix}_${entityId.toString().padStart(2, '0')}_${new Date().getFullYear().toString().slice(-2)}`;
      let fileName = `${baseName}${ext}`;
      let version = 1;
      
      // Check for existing files and increment version
      const uploadDir = path.join(__dirname, '../uploads/attachments', new Date().getFullYear().toString(), (new Date().getMonth() + 1).toString().padStart(2, '0'), entityType);
      
      while (true) {
        const filePath = path.join(uploadDir, fileName);
        try {
          await fs.access(filePath);
          version++;
          fileName = `${baseName}_${version}${ext}`;
        } catch {
          break;
        }
      }
      
      req.fileVersion = version;
      cb(null, fileName);
    } catch (error) {
      cb(error);
    }
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'application/zip', 'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Download attachment (must be before /:entityType/:entityId route)
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM attachments WHERE id = $1 AND is_active = TRUE',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const attachment = result.rows[0];
    
    // Check if file exists
    try {
      await fs.access(attachment.file_path);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Use res.sendFile which is more reliable for file downloads
    res.sendFile(attachment.file_path, {
      headers: {
        'Content-Type': attachment.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${attachment.original_name}"`
      }
    }, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error sending file' });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Get all attachments for an entity
router.get('/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const result = await db.query(
      `SELECT a.*, u.name as uploaded_by_name
       FROM attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.entity_type = $1 AND a.entity_id = $2 AND a.is_active = TRUE
       ORDER BY a.uploaded_at DESC`,
      [entityType, entityId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Upload new attachment
router.post('/upload/:entityType/:entityId', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { description } = req.body;
    const uploadedBy = req.user.id;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const attachments = [];
    
    for (const file of req.files) {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      const result = await db.query(
        `INSERT INTO attachments (
          entity_type, entity_id, file_name, original_name, file_path, 
          file_type, file_size, uploaded_by, description, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          entityType,
          entityId,
          file.filename,
          file.originalname,
          file.path,
          file.mimetype,
          file.size,
          uploadedBy,
          description || null,
          req.fileVersion || 1
        ]
      );
      
      attachments.push(result.rows[0]);
    }
    
    res.json({ 
      message: 'Files uploaded successfully', 
      attachments,
      count: attachments.length 
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    
    // Clean up uploaded files if database insert fails
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }
    
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get attachment preview/info
router.get('/info/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT a.*, u.name as uploaded_by_name
       FROM attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.id = $1 AND a.is_active = TRUE`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const attachment = result.rows[0];
    
    // Check if file exists
    try {
      const stats = await fs.stat(attachment.file_path);
      attachment.file_exists = true;
      attachment.file_size_actual = stats.size;
    } catch {
      attachment.file_exists = false;
      attachment.file_size_actual = 0;
    }
    
    res.json(attachment);
  } catch (error) {
    console.error('Error getting attachment info:', error);
    res.status(500).json({ error: 'Failed to get attachment info' });
  }
});

// Delete attachment (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE attachments SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const attachment = result.rows[0];
    
    // Optionally delete the physical file
    try {
      await fs.unlink(attachment.file_path);
    } catch (unlinkError) {
      console.error('Error deleting physical file:', unlinkError);
      // Don't fail the request if file deletion fails
    }
    
    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Bulk delete attachments
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { attachmentIds } = req.body;
    
    if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return res.status(400).json({ error: 'No attachment IDs provided' });
    }
    
    const result = await db.query(
      `UPDATE attachments 
       SET is_active = FALSE, updated_at = NOW() 
       WHERE id = ANY($1) 
       RETURNING *`,
      [attachmentIds]
    );
    
    // Delete physical files
    for (const attachment of result.rows) {
      try {
        await fs.unlink(attachment.file_path);
      } catch (unlinkError) {
        console.error('Error deleting physical file:', unlinkError);
      }
    }
    
    res.json({ 
      message: 'Attachments deleted successfully', 
      deleted_count: result.rows.length 
    });
  } catch (error) {
    console.error('Error bulk deleting attachments:', error);
    res.status(500).json({ error: 'Failed to delete attachments' });
  }
});

// Update attachment description
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    
    const result = await db.query(
      'UPDATE attachments SET description = $1, updated_at = NOW() WHERE id = $2 AND is_active = TRUE RETURNING *',
      [description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating attachment:', error);
    res.status(500).json({ error: 'Failed to update attachment' });
  }
});

module.exports = router;