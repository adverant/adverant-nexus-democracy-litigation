/**
 * Documents Router
 *
 * Document upload, triage, and management with multer file handling
 */

import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/error';
import { getUserContext } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import { DocAIService } from '../services/docai';
import {
  ApiResponse,
  PaginatedResponse,
  DBDocument,
  DocumentType,
  ValidationError,
  NotFoundError,
  JobType,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const queueService = QueueService.getInstance();
const docAI = DocAIService.getInstance();

// Configure multer for file uploads
const UPLOAD_STORAGE_PATH = process.env.UPLOAD_STORAGE_PATH || '/tmp/democracy-litigation/uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_STORAGE_PATH)) {
  fs.mkdirSync(UPLOAD_STORAGE_PATH, { recursive: true });
  logger.info('Created upload directory', { path: UPLOAD_STORAGE_PATH });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_STORAGE_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB default
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOCX, DOC, images
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/tif',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Invalid file type: ${file.mimetype}. Allowed types: PDF, DOCX, DOC, JPEG, PNG, TIFF`
        ) as any
      );
    }
  },
});

/**
 * POST /documents/upload
 * Upload a document file
 *
 * Multipart form data:
 * - file: File (required, max 100MB)
 * - case_id: string UUID (required)
 * - doc_type: DocumentType (required)
 * - tags: string[] (optional, JSON array)
 *
 * Returns: Created document record
 */
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const file = req.file;

    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    const caseId = req.body.case_id;
    const docType = req.body.doc_type as DocumentType;
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];

    // Validate required fields
    if (!caseId || !docType) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      throw new ValidationError('Missing required fields: case_id, doc_type');
    }

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      throw new NotFoundError('Case', caseId);
    }

    logger.info('Uploading document', {
      userId: user.userId,
      caseId,
      filename: file.originalname,
      size: file.size,
      docType,
    });

    // Insert document record
    const result = await db.query<DBDocument>(
      `INSERT INTO dl.documents (
        case_id, user_id, filename, file_size_bytes, storage_path,
        doc_type, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        caseId,
        user.userId,
        file.originalname,
        file.size,
        file.path,
        docType,
        tags,
        JSON.stringify({
          mimetype: file.mimetype,
          originalname: file.originalname,
        }),
      ]
    );

    const document = result.rows[0];

    logger.info('Document uploaded successfully', {
      userId: user.userId,
      documentId: document.id,
      caseId,
      filename: file.originalname,
    });

    const response: ApiResponse<DBDocument> = {
      success: true,
      data: document,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  })
);

/**
 * GET /documents
 * List documents for a case
 *
 * Query params:
 * - case_id: string UUID (required)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - doc_type: DocumentType (optional filter)
 * - search: string (optional, search filename and tags)
 *
 * Returns: Paginated list of documents
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.query.case_id as string;

    if (!caseId) {
      throw new ValidationError('Missing required query parameter: case_id');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const docType = req.query.doc_type as DocumentType | undefined;
    const search = req.query.search as string | undefined;

    logger.info('Listing documents', {
      userId: user.userId,
      caseId,
      page,
      limit,
      filters: { docType, search },
    });

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    // Build WHERE clause
    const conditions: string[] = ['case_id = $1', 'user_id = $2'];
    const params: any[] = [caseId, user.userId];
    let paramIndex = 3;

    if (docType) {
      conditions.push(`doc_type = $${paramIndex}`);
      params.push(docType);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(filename ILIKE $${paramIndex} OR $${paramIndex} = ANY(tags))`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.documents WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get documents
    const documentsResult = await db.query<DBDocument>(
      `SELECT
        id, case_id, user_id, filename, file_size_bytes, storage_path,
        doc_type, tags, ocr_text, relevance_score, privilege_score,
        triage_status, metadata, uploaded_at
       FROM dl.documents
       WHERE ${whereClause}
       ORDER BY uploaded_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBDocument>> = {
      success: true,
      data: {
        data: documentsResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Documents listed successfully', {
      userId: user.userId,
      caseId,
      count: documentsResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * GET /documents/:id
 * Get document by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Document details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const documentId = req.params.id;

    logger.info('Getting document', {
      userId: user.userId,
      documentId,
    });

    const result = await db.query<DBDocument>(
      `SELECT
        id, case_id, user_id, filename, file_size_bytes, storage_path,
        doc_type, tags, ocr_text, relevance_score, privilege_score,
        triage_status, metadata, uploaded_at
       FROM dl.documents
       WHERE id = $1 AND user_id = $2`,
      [documentId, user.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Document', documentId);
    }

    const document = result.rows[0];

    logger.info('Document retrieved successfully', {
      userId: user.userId,
      documentId,
    });

    const response: ApiResponse<DBDocument> = {
      success: true,
      data: document,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * DELETE /documents/:id
 * Delete document (removes file and database record)
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Success confirmation
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const documentId = req.params.id;

    logger.info('Deleting document', {
      userId: user.userId,
      documentId,
    });

    // Get document to verify ownership and get file path
    const document = await db.queryOne<DBDocument>(
      `SELECT id, filename, storage_path FROM dl.documents WHERE id = $1 AND user_id = $2`,
      [documentId, user.userId]
    );

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    // Delete physical file
    try {
      if (fs.existsSync(document.storage_path)) {
        fs.unlinkSync(document.storage_path);
        logger.debug('Physical file deleted', { path: document.storage_path });
      }
    } catch (error) {
      logger.error('Failed to delete physical file', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: document.storage_path,
      });
      // Continue with database deletion even if file deletion fails
    }

    // Delete database record
    await db.query(`DELETE FROM dl.documents WHERE id = $1 AND user_id = $2`, [
      documentId,
      user.userId,
    ]);

    logger.info('Document deleted successfully', {
      userId: user.userId,
      documentId,
      filename: document.filename,
    });

    const response: ApiResponse<{ id: string; message: string }> = {
      success: true,
      data: {
        id: documentId,
        message: 'Document deleted successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /documents/triage
 * Trigger document triage job
 *
 * Body:
 * - document_ids: string[] (required, array of document UUIDs)
 * - relevance_threshold: number (optional, 0-1, default: 0.5)
 * - privilege_threshold: number (optional, 0-1, default: 0.7)
 *
 * Returns: Job ID and status
 */
router.post(
  '/triage',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const documentIds = req.body.document_ids as string[];
    const relevanceThreshold = req.body.relevance_threshold || 0.5;
    const privilegeThreshold = req.body.privilege_threshold || 0.7;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('Missing or invalid document_ids array');
    }

    logger.info('Creating document triage job', {
      userId: user.userId,
      documentCount: documentIds.length,
      thresholds: { relevanceThreshold, privilegeThreshold },
    });

    // Verify all documents exist and belong to user
    const documentsResult = await db.query<{ id: string; case_id: string }>(
      `SELECT id, case_id FROM dl.documents WHERE id = ANY($1) AND user_id = $2`,
      [documentIds, user.userId]
    );

    if (documentsResult.rows.length !== documentIds.length) {
      throw new ValidationError(
        `Some documents not found or do not belong to user. Found: ${documentsResult.rows.length}, Expected: ${documentIds.length}`
      );
    }

    const caseId = documentsResult.rows[0].case_id;

    // Create job record
    const jobResult = await db.query<{ id: string }>(
      `INSERT INTO dl.jobs (
        case_id, user_id, job_type, status, progress
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [caseId, user.userId, 'document_triage', 'pending', 0]
    );

    const jobId = jobResult.rows[0].id;

    // Add job to queue
    await queueService.addJob(
      'document_triage' as JobType,
      {
        type: 'document_triage' as JobType,
        userId: user.userId,
        caseId: caseId,
        params: {
          documentIds,
          relevanceThreshold,
          privilegeThreshold,
        },
      },
      jobId
    );

    logger.info('Document triage job created', {
      userId: user.userId,
      jobId,
      documentCount: documentIds.length,
    });

    const response: ApiResponse<{ job_id: string; status: string; message: string }> = {
      success: true,
      data: {
        job_id: jobId,
        status: 'pending',
        message: `Triage job created for ${documentIds.length} document(s)`,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(202).json(response);
  })
);

/**
 * POST /documents/extract-text
 * Extract text from document via DocAI (synchronous OCR)
 *
 * Body:
 * - document_id: string (required, UUID)
 * - extract_tables: boolean (optional, default: false)
 * - extract_images: boolean (optional, default: false)
 *
 * Returns: Extracted text and metadata
 */
router.post(
  '/extract-text',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const documentId = req.body.document_id as string;
    const extractTables = req.body.extract_tables || false;
    const extractImages = req.body.extract_images || false;

    if (!documentId) {
      throw new ValidationError('Missing required field: document_id');
    }

    logger.info('Extracting text from document', {
      userId: user.userId,
      documentId,
      extractTables,
      extractImages,
    });

    // Get document
    const document = await db.queryOne<DBDocument>(
      `SELECT id, storage_path, filename FROM dl.documents WHERE id = $1 AND user_id = $2`,
      [documentId, user.userId]
    );

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    // Verify file exists
    if (!fs.existsSync(document.storage_path)) {
      throw new ValidationError(`Document file not found at: ${document.storage_path}`);
    }

    // Extract text via DocAI
    const ocrResult = await docAI.extractText({
      filePath: document.storage_path,
      extractTables,
      extractImages,
    });

    // Update document with OCR text
    await db.query(
      `UPDATE dl.documents SET ocr_text = $1 WHERE id = $2`,
      [ocrResult.text, documentId]
    );

    logger.info('Text extracted successfully', {
      userId: user.userId,
      documentId,
      textLength: ocrResult.text.length,
      pages: ocrResult.pages,
      confidence: ocrResult.confidence,
    });

    const response: ApiResponse<{
      document_id: string;
      text: string;
      pages: number;
      confidence: number;
      tables?: any[];
      images?: any[];
    }> = {
      success: true,
      data: {
        document_id: documentId,
        text: ocrResult.text,
        pages: ocrResult.pages,
        confidence: ocrResult.confidence,
        tables: ocrResult.tables,
        images: ocrResult.images,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default router;
