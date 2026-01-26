/**
 * Experts Router
 *
 * Expert witness management and report generation
 */

import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/error';
import { getUserContext, requireRole } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import {
  ApiResponse,
  PaginatedResponse,
  DBExpertWitness,
  ExpertSpecialty,
  ValidationError,
  NotFoundError,
  JobType,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const queueService = QueueService.getInstance();

/**
 * GET /experts
 * List expert witnesses with filters
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - specialty: ExpertSpecialty (optional filter)
 * - search: string (optional, search by name or affiliation)
 *
 * Returns: Paginated list of experts
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const specialty = req.query.specialty as ExpertSpecialty | undefined;
    const search = req.query.search as string | undefined;

    logger.info('Listing experts', {
      userId: user.userId,
      page,
      limit,
      filters: { specialty, search },
    });

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (specialty) {
      conditions.push(`specialty = $${paramIndex}`);
      params.push(specialty);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR affiliation ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.expert_witnesses ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get experts
    const expertsResult = await db.query<DBExpertWitness>(
      `SELECT
        id, name, affiliation, specialty, bio, cv_url,
        testimony_count, daubert_challenges, daubert_successes,
        track_record, metadata, created_at
       FROM dl.expert_witnesses
       ${whereClause}
       ORDER BY name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBExpertWitness>> = {
      success: true,
      data: {
        data: expertsResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Experts listed successfully', {
      userId: user.userId,
      count: expertsResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * GET /experts/:id
 * Get expert by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Expert details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const expertId = req.params.id;

    logger.info('Getting expert', {
      userId: user.userId,
      expertId,
    });

    const result = await db.query<DBExpertWitness>(
      `SELECT
        id, name, affiliation, specialty, bio, cv_url,
        testimony_count, daubert_challenges, daubert_successes,
        track_record, metadata, created_at
       FROM dl.expert_witnesses
       WHERE id = $1`,
      [expertId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Expert', expertId);
    }

    const expert = result.rows[0];

    logger.info('Expert retrieved successfully', {
      userId: user.userId,
      expertId,
    });

    const response: ApiResponse<DBExpertWitness> = {
      success: true,
      data: expert,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /experts
 * Create expert witness record (admin only)
 *
 * Body:
 * - name: string (required)
 * - affiliation: string (optional)
 * - specialty: ExpertSpecialty (required)
 * - bio: string (optional)
 * - cv_url: string (optional)
 * - testimony_count: number (optional, default: 0)
 * - daubert_challenges: number (optional, default: 0)
 * - daubert_successes: number (optional, default: 0)
 * - track_record: object (optional)
 *
 * Returns: Created expert
 */
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const name = req.body.name as string;
    const affiliation = req.body.affiliation as string | undefined;
    const specialty = req.body.specialty as ExpertSpecialty;
    const bio = req.body.bio as string | undefined;
    const cvUrl = req.body.cv_url as string | undefined;
    const testimonyCount = req.body.testimony_count || 0;
    const daubertChallenges = req.body.daubert_challenges || 0;
    const daubertSuccesses = req.body.daubert_successes || 0;
    const trackRecord = req.body.track_record || {};

    // Validate required fields
    if (!name || !specialty) {
      throw new ValidationError('Missing required fields: name, specialty');
    }

    // Validate specialty enum
    const validSpecialties: ExpertSpecialty[] = [
      'statistician',
      'demographer',
      'political_scientist',
      'historian',
      'economist',
      'cartographer',
    ];

    if (!validSpecialties.includes(specialty)) {
      throw new ValidationError(
        `Invalid specialty. Must be one of: ${validSpecialties.join(', ')}`
      );
    }

    logger.info('Creating expert (admin)', {
      userId: user.userId,
      name,
      specialty,
    });

    // Insert expert
    const result = await db.query<DBExpertWitness>(
      `INSERT INTO dl.expert_witnesses (
        name, affiliation, specialty, bio, cv_url,
        testimony_count, daubert_challenges, daubert_successes,
        track_record, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name,
        affiliation || null,
        specialty,
        bio || null,
        cvUrl || null,
        testimonyCount,
        daubertChallenges,
        daubertSuccesses,
        JSON.stringify(trackRecord),
        JSON.stringify({
          created_by: user.userId,
          created_at: new Date().toISOString(),
        }),
      ]
    );

    const expert = result.rows[0];

    logger.info('Expert created successfully', {
      userId: user.userId,
      expertId: expert.id,
      name: expert.name,
    });

    const response: ApiResponse<DBExpertWitness> = {
      success: true,
      data: expert,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  })
);

/**
 * PUT /experts/:id
 * Update expert witness record (admin only)
 *
 * Params:
 * - id: string (UUID)
 *
 * Body: (all fields optional)
 * - name: string
 * - affiliation: string
 * - specialty: ExpertSpecialty
 * - bio: string
 * - cv_url: string
 * - testimony_count: number
 * - daubert_challenges: number
 * - daubert_successes: number
 * - track_record: object
 *
 * Returns: Updated expert
 */
router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const expertId = req.params.id;
    const body = req.body;

    logger.info('Updating expert (admin)', {
      userId: user.userId,
      expertId,
      updates: Object.keys(body),
    });

    // Verify expert exists
    const existingExpert = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.expert_witnesses WHERE id = $1`,
      [expertId]
    );

    if (!existingExpert) {
      throw new NotFoundError('Expert', expertId);
    }

    // Build UPDATE clause dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(body.name);
      paramIndex++;
    }

    if (body.affiliation !== undefined) {
      updates.push(`affiliation = $${paramIndex}`);
      params.push(body.affiliation);
      paramIndex++;
    }

    if (body.specialty !== undefined) {
      updates.push(`specialty = $${paramIndex}`);
      params.push(body.specialty);
      paramIndex++;
    }

    if (body.bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      params.push(body.bio);
      paramIndex++;
    }

    if (body.cv_url !== undefined) {
      updates.push(`cv_url = $${paramIndex}`);
      params.push(body.cv_url);
      paramIndex++;
    }

    if (body.testimony_count !== undefined) {
      updates.push(`testimony_count = $${paramIndex}`);
      params.push(body.testimony_count);
      paramIndex++;
    }

    if (body.daubert_challenges !== undefined) {
      updates.push(`daubert_challenges = $${paramIndex}`);
      params.push(body.daubert_challenges);
      paramIndex++;
    }

    if (body.daubert_successes !== undefined) {
      updates.push(`daubert_successes = $${paramIndex}`);
      params.push(body.daubert_successes);
      paramIndex++;
    }

    if (body.track_record !== undefined) {
      updates.push(`track_record = $${paramIndex}`);
      params.push(JSON.stringify(body.track_record));
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Update expert
    const result = await db.query<DBExpertWitness>(
      `UPDATE dl.expert_witnesses
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      [...params, expertId]
    );

    const updatedExpert = result.rows[0];

    logger.info('Expert updated successfully', {
      userId: user.userId,
      expertId,
    });

    const response: ApiResponse<DBExpertWitness> = {
      success: true,
      data: updatedExpert,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /experts/:id/generate-report
 * Generate expert report (create job)
 *
 * Params:
 * - id: string (expert UUID)
 *
 * Body:
 * - case_id: string UUID (required)
 * - report_type: string (required, e.g., 'statistical_analysis', 'historical_context', 'demographic_analysis')
 * - parameters: object (optional, report-specific parameters)
 *
 * Returns: Job ID and status
 */
router.post(
  '/:id/generate-report',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const expertId = req.params.id;
    const caseId = req.body.case_id as string;
    const reportType = req.body.report_type as string;
    const parameters = req.body.parameters || {};

    if (!caseId || !reportType) {
      throw new ValidationError('Missing required fields: case_id, report_type');
    }

    // Verify expert exists
    const expert = await db.queryOne<{ id: string; name: string; specialty: ExpertSpecialty }>(
      `SELECT id, name, specialty FROM dl.expert_witnesses WHERE id = $1`,
      [expertId]
    );

    if (!expert) {
      throw new NotFoundError('Expert', expertId);
    }

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    logger.info('Creating expert report generation job', {
      userId: user.userId,
      expertId,
      expertName: expert.name,
      caseId,
      reportType,
    });

    // Create job record
    const jobResult = await db.query<{ id: string }>(
      `INSERT INTO dl.jobs (
        case_id, user_id, job_type, status, progress
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [caseId, user.userId, 'expert_report_generation', 'pending', 0]
    );

    const jobId = jobResult.rows[0].id;

    // Add job to queue
    await queueService.addJob(
      'expert_report_generation' as JobType,
      {
        type: 'expert_report_generation' as JobType,
        userId: user.userId,
        caseId: caseId,
        params: {
          expertId,
          expertName: expert.name,
          specialty: expert.specialty,
          reportType,
          parameters,
        },
      },
      jobId
    );

    logger.info('Expert report generation job created', {
      userId: user.userId,
      jobId,
      expertId,
      reportType,
    });

    const response: ApiResponse<{
      job_id: string;
      status: string;
      expert: { id: string; name: string };
      message: string;
    }> = {
      success: true,
      data: {
        job_id: jobId,
        status: 'pending',
        expert: {
          id: expert.id,
          name: expert.name,
        },
        message: `Expert report generation job created for ${expert.name}`,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(202).json(response);
  })
);

export default router;
