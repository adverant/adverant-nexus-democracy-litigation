/**
 * Jobs Router
 *
 * Job status queries and management
 */

import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/error';
import { getUserContext } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import {
  ApiResponse,
  PaginatedResponse,
  DBJob,
  ValidationError,
  NotFoundError,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const queueService = QueueService.getInstance();

/**
 * GET /jobs
 * List jobs for user
 *
 * Query params:
 * - case_id: string UUID (optional, filter by case)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - job_type: string (optional filter)
 * - status: string (optional filter: 'pending', 'running', 'completed', 'failed')
 *
 * Returns: Paginated list of jobs
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;

    const caseId = req.query.case_id as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const jobType = req.query.job_type as string | undefined;
    const status = req.query.status as string | undefined;

    logger.info('Listing jobs', {
      userId: user.userId,
      caseId,
      page,
      limit,
      filters: { jobType, status },
    });

    // Build WHERE clause
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [user.userId];
    let paramIndex = 2;

    if (caseId) {
      conditions.push(`case_id = $${paramIndex}`);
      params.push(caseId);
      paramIndex++;
    }

    if (jobType) {
      conditions.push(`job_type = $${paramIndex}`);
      params.push(jobType);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.jobs WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get jobs
    const jobsResult = await db.query<DBJob>(
      `SELECT
        id, case_id, user_id, job_type, status, progress,
        result, error, started_at, completed_at, created_at
       FROM dl.jobs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBJob>> = {
      success: true,
      data: {
        data: jobsResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Jobs listed successfully', {
      userId: user.userId,
      count: jobsResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * GET /jobs/:id
 * Get job by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Job details with full result and error information
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const jobId = req.params.id;

    logger.info('Getting job', {
      userId: user.userId,
      jobId,
    });

    const result = await db.query<DBJob>(
      `SELECT
        id, case_id, user_id, job_type, status, progress,
        result, error, started_at, completed_at, created_at
       FROM dl.jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, user.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Job', jobId);
    }

    const job = result.rows[0];

    logger.info('Job retrieved successfully', {
      userId: user.userId,
      jobId,
      status: job.status,
      progress: job.progress,
    });

    const response: ApiResponse<DBJob> = {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * DELETE /jobs/:id
 * Cancel job
 *
 * Params:
 * - id: string (UUID)
 *
 * Note: This only cancels jobs that are 'pending' status.
 * Jobs that are already 'running' cannot be cancelled via this endpoint.
 *
 * Returns: Success confirmation
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const jobId = req.params.id;

    logger.info('Cancelling job', {
      userId: user.userId,
      jobId,
    });

    // Get job
    const job = await db.queryOne<DBJob>(
      `SELECT id, job_type, status FROM dl.jobs WHERE id = $1 AND user_id = $2`,
      [jobId, user.userId]
    );

    if (!job) {
      throw new NotFoundError('Job', jobId);
    }

    // Check if job can be cancelled
    if (job.status === 'completed') {
      throw new ValidationError('Cannot cancel completed job');
    }

    if (job.status === 'failed') {
      throw new ValidationError('Cannot cancel failed job');
    }

    if (job.status === 'running') {
      logger.warn('Attempted to cancel running job', {
        userId: user.userId,
        jobId,
      });
      throw new ValidationError(
        'Cannot cancel running job. Job is already being processed.'
      );
    }

    // Update job status to 'cancelled'
    await db.query(
      `UPDATE dl.jobs
       SET status = 'cancelled', error = 'Cancelled by user', completed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [jobId, user.userId]
    );

    // Note: For BullMQ job removal, you would need to implement queue-specific cancellation
    // This is a simplified version that just updates the database status

    logger.info('Job cancelled successfully', {
      userId: user.userId,
      jobId,
      jobType: job.job_type,
    });

    const response: ApiResponse<{ id: string; message: string }> = {
      success: true,
      data: {
        id: jobId,
        message: 'Job cancelled successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default router;
