/**
 * Deadlines Router
 *
 * Deadline management with conflict detection and business day calculations
 */

import { Router, Request } from 'express';
import { parseISO, format } from 'date-fns';
import { asyncHandler } from '../middleware/error';
import { getUserContext } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { DeadlineCalcService } from '../services/deadlineCalc';
import {
  ApiResponse,
  PaginatedResponse,
  DBDeadline,
  DeadlineType,
  Priority,
  ValidationError,
  NotFoundError,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const deadlineCalc = DeadlineCalcService.getInstance();

/**
 * GET /deadlines
 * List deadlines for user or specific case
 *
 * Query params:
 * - case_id: string UUID (optional, filter by case)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - deadline_type: DeadlineType (optional filter)
 * - priority: Priority (optional filter)
 * - status: string (optional filter: 'pending', 'completed', 'missed')
 * - upcoming: boolean (optional, only show upcoming deadlines)
 *
 * Returns: Paginated list of deadlines
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;

    const caseId = req.query.case_id as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const deadlineType = req.query.deadline_type as DeadlineType | undefined;
    const priority = req.query.priority as Priority | undefined;
    const status = req.query.status as string | undefined;
    const upcoming = req.query.upcoming === 'true';

    logger.info('Listing deadlines', {
      userId: user.userId,
      caseId,
      page,
      limit,
      filters: { deadlineType, priority, status, upcoming },
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

    if (deadlineType) {
      conditions.push(`deadline_type = $${paramIndex}`);
      params.push(deadlineType);
      paramIndex++;
    }

    if (priority) {
      conditions.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (upcoming) {
      conditions.push(`deadline_date >= NOW()`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.deadlines WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get deadlines
    const deadlinesResult = await db.query<DBDeadline>(
      `SELECT
        id, case_id, user_id, title, deadline_date, deadline_type,
        priority, status, alert_intervals, metadata, created_at
       FROM dl.deadlines
       WHERE ${whereClause}
       ORDER BY deadline_date ASC, priority DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBDeadline>> = {
      success: true,
      data: {
        data: deadlinesResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Deadlines listed successfully', {
      userId: user.userId,
      count: deadlinesResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * POST /deadlines
 * Create deadline with conflict detection
 *
 * Body:
 * - case_id: string UUID (required)
 * - title: string (required)
 * - deadline_date: ISO date string (required)
 * - deadline_type: DeadlineType (required)
 * - priority: Priority (required)
 * - alert_intervals: number[] (optional, days before deadline, e.g., [7, 3, 1])
 * - metadata: object (optional)
 * - check_conflicts: boolean (optional, default: true)
 *
 * Returns: Created deadline with conflict warnings if any
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.body.case_id as string;
    const title = req.body.title as string;
    const deadlineDateStr = req.body.deadline_date as string;
    const deadlineType = req.body.deadline_type as DeadlineType;
    const priority = req.body.priority as Priority;
    const alertIntervals = req.body.alert_intervals || [7, 3, 1];
    const metadata = req.body.metadata || {};
    const checkConflicts = req.body.check_conflicts !== false;

    // Validate required fields
    if (!caseId || !title || !deadlineDateStr || !deadlineType || !priority) {
      throw new ValidationError(
        'Missing required fields: case_id, title, deadline_date, deadline_type, priority'
      );
    }

    // Parse and validate deadline date
    let deadlineDate: Date;
    try {
      deadlineDate = parseISO(deadlineDateStr);
      if (isNaN(deadlineDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      throw new ValidationError('Invalid deadline_date format. Expected ISO date string.');
    }

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    logger.info('Creating deadline', {
      userId: user.userId,
      caseId,
      title,
      deadlineDate: format(deadlineDate, 'yyyy-MM-dd'),
      deadlineType,
      priority,
    });

    // Check for conflicts if requested
    let conflicts: any = null;
    if (checkConflicts) {
      // Get existing deadlines for conflict detection
      const existingDeadlines = await db.query<{
        id: string;
        title: string;
        deadline_date: Date;
        priority: Priority;
      }>(
        `SELECT id, title, deadline_date, priority
         FROM dl.deadlines
         WHERE user_id = $1 AND status = 'pending'`,
        [user.userId]
      );

      const conflictResult = await deadlineCalc.detectConflicts({
        proposedDate: deadlineDate,
        existingDeadlines: existingDeadlines.rows,
        bufferDays: 3,
      });

      if (conflictResult.hasConflicts) {
        conflicts = conflictResult;
        logger.warn('Deadline has conflicts', {
          userId: user.userId,
          conflictsCount: conflictResult.conflicts.length,
        });
      }
    }

    // Insert deadline
    const result = await db.query<DBDeadline>(
      `INSERT INTO dl.deadlines (
        case_id, user_id, title, deadline_date, deadline_type,
        priority, status, alert_intervals, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        caseId,
        user.userId,
        title,
        deadlineDate,
        deadlineType,
        priority,
        'pending',
        alertIntervals,
        JSON.stringify(metadata),
      ]
    );

    const deadline = result.rows[0];

    logger.info('Deadline created successfully', {
      userId: user.userId,
      deadlineId: deadline.id,
      title: deadline.title,
      hasConflicts: conflicts?.hasConflicts || false,
    });

    const response: ApiResponse<{
      deadline: DBDeadline;
      conflicts?: any;
    }> = {
      success: true,
      data: {
        deadline,
        ...(conflicts && { conflicts }),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  })
);

/**
 * GET /deadlines/:id
 * Get deadline by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Deadline details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const deadlineId = req.params.id;

    logger.info('Getting deadline', {
      userId: user.userId,
      deadlineId,
    });

    const result = await db.query<DBDeadline>(
      `SELECT
        id, case_id, user_id, title, deadline_date, deadline_type,
        priority, status, alert_intervals, metadata, created_at
       FROM dl.deadlines
       WHERE id = $1 AND user_id = $2`,
      [deadlineId, user.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Deadline', deadlineId);
    }

    const deadline = result.rows[0];

    logger.info('Deadline retrieved successfully', {
      userId: user.userId,
      deadlineId,
    });

    const response: ApiResponse<DBDeadline> = {
      success: true,
      data: deadline,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * PUT /deadlines/:id
 * Update deadline
 *
 * Params:
 * - id: string (UUID)
 *
 * Body: (all fields optional)
 * - title: string
 * - deadline_date: ISO date string
 * - deadline_type: DeadlineType
 * - priority: Priority
 * - status: string ('pending', 'completed', 'missed')
 * - alert_intervals: number[]
 * - metadata: object
 *
 * Returns: Updated deadline
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const deadlineId = req.params.id;
    const body = req.body;

    logger.info('Updating deadline', {
      userId: user.userId,
      deadlineId,
      updates: Object.keys(body),
    });

    // Verify deadline exists and belongs to user
    const existingDeadline = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.deadlines WHERE id = $1 AND user_id = $2`,
      [deadlineId, user.userId]
    );

    if (!existingDeadline) {
      throw new NotFoundError('Deadline', deadlineId);
    }

    // Build UPDATE clause dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(body.title);
      paramIndex++;
    }

    if (body.deadline_date !== undefined) {
      try {
        const deadlineDate = parseISO(body.deadline_date);
        if (isNaN(deadlineDate.getTime())) {
          throw new Error('Invalid date');
        }
        updates.push(`deadline_date = $${paramIndex}`);
        params.push(deadlineDate);
        paramIndex++;
      } catch (error) {
        throw new ValidationError('Invalid deadline_date format');
      }
    }

    if (body.deadline_type !== undefined) {
      updates.push(`deadline_type = $${paramIndex}`);
      params.push(body.deadline_type);
      paramIndex++;
    }

    if (body.priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      params.push(body.priority);
      paramIndex++;
    }

    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(body.status);
      paramIndex++;
    }

    if (body.alert_intervals !== undefined) {
      updates.push(`alert_intervals = $${paramIndex}`);
      params.push(body.alert_intervals);
      paramIndex++;
    }

    if (body.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(body.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Update deadline
    const result = await db.query<DBDeadline>(
      `UPDATE dl.deadlines
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...params, deadlineId, user.userId]
    );

    const updatedDeadline = result.rows[0];

    logger.info('Deadline updated successfully', {
      userId: user.userId,
      deadlineId,
    });

    const response: ApiResponse<DBDeadline> = {
      success: true,
      data: updatedDeadline,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * DELETE /deadlines/:id
 * Delete deadline
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
    const deadlineId = req.params.id;

    logger.info('Deleting deadline', {
      userId: user.userId,
      deadlineId,
    });

    // Verify deadline exists and belongs to user
    const existingDeadline = await db.queryOne<{ id: string; title: string }>(
      `SELECT id, title FROM dl.deadlines WHERE id = $1 AND user_id = $2`,
      [deadlineId, user.userId]
    );

    if (!existingDeadline) {
      throw new NotFoundError('Deadline', deadlineId);
    }

    // Delete deadline
    await db.query(`DELETE FROM dl.deadlines WHERE id = $1 AND user_id = $2`, [
      deadlineId,
      user.userId,
    ]);

    logger.info('Deadline deleted successfully', {
      userId: user.userId,
      deadlineId,
      title: existingDeadline.title,
    });

    const response: ApiResponse<{ id: string; message: string }> = {
      success: true,
      data: {
        id: deadlineId,
        message: 'Deadline deleted successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /deadlines/detect-conflicts
 * Check for deadline conflicts (without creating a deadline)
 *
 * Body:
 * - proposed_date: ISO date string (required)
 * - buffer_days: number (optional, default: 3)
 *
 * Returns: Conflicts and recommendations
 */
router.post(
  '/detect-conflicts',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const proposedDateStr = req.body.proposed_date as string;
    const bufferDays = req.body.buffer_days || 3;

    if (!proposedDateStr) {
      throw new ValidationError('Missing required field: proposed_date');
    }

    // Parse proposed date
    let proposedDate: Date;
    try {
      proposedDate = parseISO(proposedDateStr);
      if (isNaN(proposedDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      throw new ValidationError('Invalid proposed_date format. Expected ISO date string.');
    }

    logger.info('Detecting deadline conflicts', {
      userId: user.userId,
      proposedDate: format(proposedDate, 'yyyy-MM-dd'),
      bufferDays,
    });

    // Get existing deadlines
    const existingDeadlines = await db.query<{
      id: string;
      title: string;
      deadline_date: Date;
      priority: Priority;
    }>(
      `SELECT id, title, deadline_date, priority
       FROM dl.deadlines
       WHERE user_id = $1 AND status = 'pending'`,
      [user.userId]
    );

    // Detect conflicts
    const conflictResult = await deadlineCalc.detectConflicts({
      proposedDate,
      existingDeadlines: existingDeadlines.rows,
      bufferDays,
    });

    logger.info('Conflict detection completed', {
      userId: user.userId,
      hasConflicts: conflictResult.hasConflicts,
      conflictsCount: conflictResult.conflicts.length,
    });

    const response: ApiResponse<typeof conflictResult> = {
      success: true,
      data: conflictResult,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default router;
