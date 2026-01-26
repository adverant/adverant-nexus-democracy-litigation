/**
 * Cases Router
 *
 * Case CRUD operations with pagination, filters, and search
 */

import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/error';
import { getUserContext } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import {
  ApiResponse,
  PaginatedResponse,
  DBCase,
  ListCasesRequest,
  CreateCaseRequest,
  UpdateCaseRequest,
  CaseStatus,
  CaseType,
  CasePhase,
  ValidationError,
  NotFoundError,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();

/**
 * GET /cases
 * List cases with pagination and filters
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: CaseStatus (active, settled, dismissed, won, lost, on_hold, appeal, remanded)
 * - case_type: CaseType (redistricting, voter_id, ballot_access, etc.)
 * - phase: CasePhase (discovery, motion_practice, trial_prep, trial, appeal, etc.)
 * - search: string (search by name, case_number, court_name)
 *
 * Returns: Paginated list of cases for the authenticated user
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as CaseStatus | undefined;
    const caseType = req.query.case_type as CaseType | undefined;
    const phase = req.query.phase as CasePhase | undefined;
    const search = req.query.search as string | undefined;

    logger.info('Listing cases', {
      userId: user.userId,
      page,
      limit,
      filters: { status, caseType, phase, search },
    });

    // Build WHERE clause
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [user.userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (caseType) {
      conditions.push(`case_type = $${paramIndex}`);
      params.push(caseType);
      paramIndex++;
    }

    if (phase) {
      conditions.push(`phase = $${paramIndex}`);
      params.push(phase);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR case_number ILIKE $${paramIndex} OR court_name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.cases WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get cases
    const casesResult = await db.query<DBCase>(
      `SELECT
        id, user_id, name, case_number, case_type, status, phase,
        court_name, jurisdiction, plaintiffs, defendants, counsel,
        legal_claims, filing_date, trial_date, metadata,
        created_at, updated_at
       FROM dl.cases
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBCase>> = {
      success: true,
      data: {
        data: casesResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Cases listed successfully', {
      userId: user.userId,
      count: casesResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * POST /cases
 * Create a new case
 *
 * Body: CreateCaseRequest
 * - name: string (required)
 * - case_type: CaseType (required)
 * - court_name: string (optional)
 * - jurisdiction: string (optional)
 * - plaintiffs: object[] (optional)
 * - defendants: object[] (optional)
 * - counsel: object[] (optional)
 * - legal_claims: string[] (optional)
 * - filing_date: ISO date string (optional)
 *
 * Returns: Created case
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const body = req.body as CreateCaseRequest;

    // Validate required fields
    if (!body.name || !body.case_type) {
      throw new ValidationError('Missing required fields: name, case_type');
    }

    // Validate case_type enum
    const validCaseTypes: CaseType[] = [
      'redistricting',
      'voter_id',
      'ballot_access',
      'voter_purges',
      'direct_democracy',
      'poll_closures',
      'drop_box_restrictions',
      'early_voting',
      'absentee_voting',
    ];

    if (!validCaseTypes.includes(body.case_type)) {
      throw new ValidationError(
        `Invalid case_type. Must be one of: ${validCaseTypes.join(', ')}`
      );
    }

    logger.info('Creating case', {
      userId: user.userId,
      name: body.name,
      caseType: body.case_type,
    });

    // Insert case
    const result = await db.query<DBCase>(
      `INSERT INTO dl.cases (
        user_id, name, case_type, status, phase,
        court_name, jurisdiction, plaintiffs, defendants, counsel,
        legal_claims, filing_date, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        user.userId,
        body.name,
        body.case_type,
        'active' as CaseStatus,
        'discovery' as CasePhase,
        body.court_name || null,
        body.jurisdiction || null,
        JSON.stringify(body.plaintiffs || []),
        JSON.stringify(body.defendants || []),
        JSON.stringify(body.counsel || []),
        body.legal_claims || [],
        body.filing_date ? new Date(body.filing_date) : null,
        JSON.stringify({}),
      ]
    );

    const createdCase = result.rows[0];

    logger.info('Case created successfully', {
      userId: user.userId,
      caseId: createdCase.id,
      name: createdCase.name,
    });

    const response: ApiResponse<DBCase> = {
      success: true,
      data: createdCase,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  })
);

/**
 * GET /cases/:id
 * Get case by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Case details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.params.id;

    logger.info('Getting case', {
      userId: user.userId,
      caseId,
    });

    const result = await db.query<DBCase>(
      `SELECT
        id, user_id, name, case_number, case_type, status, phase,
        court_name, jurisdiction, plaintiffs, defendants, counsel,
        legal_claims, filing_date, trial_date, metadata,
        created_at, updated_at
       FROM dl.cases
       WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Case', caseId);
    }

    const caseData = result.rows[0];

    logger.info('Case retrieved successfully', {
      userId: user.userId,
      caseId,
    });

    const response: ApiResponse<DBCase> = {
      success: true,
      data: caseData,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * PUT /cases/:id
 * Update case
 *
 * Params:
 * - id: string (UUID)
 *
 * Body: UpdateCaseRequest (all fields optional)
 * - name: string
 * - case_number: string
 * - status: CaseStatus
 * - phase: CasePhase
 * - court_name: string
 * - jurisdiction: string
 * - plaintiffs: object[]
 * - defendants: object[]
 * - counsel: object[]
 * - legal_claims: string[]
 * - filing_date: ISO date string
 * - trial_date: ISO date string
 * - metadata: object
 *
 * Returns: Updated case
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.params.id;
    const body = req.body as UpdateCaseRequest;

    logger.info('Updating case', {
      userId: user.userId,
      caseId,
      updates: Object.keys(body),
    });

    // Verify case exists and belongs to user
    const existingCase = await db.queryOne<DBCase>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!existingCase) {
      throw new NotFoundError('Case', caseId);
    }

    // Build UPDATE clause dynamically
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(body.name);
      paramIndex++;
    }

    if (body.case_number !== undefined) {
      updates.push(`case_number = $${paramIndex}`);
      params.push(body.case_number);
      paramIndex++;
    }

    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(body.status);
      paramIndex++;
    }

    if (body.phase !== undefined) {
      updates.push(`phase = $${paramIndex}`);
      params.push(body.phase);
      paramIndex++;
    }

    if (body.court_name !== undefined) {
      updates.push(`court_name = $${paramIndex}`);
      params.push(body.court_name);
      paramIndex++;
    }

    if (body.jurisdiction !== undefined) {
      updates.push(`jurisdiction = $${paramIndex}`);
      params.push(body.jurisdiction);
      paramIndex++;
    }

    if (body.plaintiffs !== undefined) {
      updates.push(`plaintiffs = $${paramIndex}`);
      params.push(JSON.stringify(body.plaintiffs));
      paramIndex++;
    }

    if (body.defendants !== undefined) {
      updates.push(`defendants = $${paramIndex}`);
      params.push(JSON.stringify(body.defendants));
      paramIndex++;
    }

    if (body.counsel !== undefined) {
      updates.push(`counsel = $${paramIndex}`);
      params.push(JSON.stringify(body.counsel));
      paramIndex++;
    }

    if (body.legal_claims !== undefined) {
      updates.push(`legal_claims = $${paramIndex}`);
      params.push(body.legal_claims);
      paramIndex++;
    }

    if (body.filing_date !== undefined) {
      updates.push(`filing_date = $${paramIndex}`);
      params.push(body.filing_date ? new Date(body.filing_date) : null);
      paramIndex++;
    }

    if (body.trial_date !== undefined) {
      updates.push(`trial_date = $${paramIndex}`);
      params.push(body.trial_date ? new Date(body.trial_date) : null);
      paramIndex++;
    }

    if (body.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(body.metadata));
      paramIndex++;
    }

    if (updates.length === 1) {
      // Only updated_at, nothing to update
      throw new ValidationError('No fields to update');
    }

    // Update case
    const result = await db.query<DBCase>(
      `UPDATE dl.cases
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...params, caseId, user.userId]
    );

    const updatedCase = result.rows[0];

    logger.info('Case updated successfully', {
      userId: user.userId,
      caseId,
    });

    const response: ApiResponse<DBCase> = {
      success: true,
      data: updatedCase,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * DELETE /cases/:id
 * Delete case (soft delete - sets status to 'dismissed')
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
    const caseId = req.params.id;

    logger.info('Deleting case', {
      userId: user.userId,
      caseId,
    });

    // Verify case exists and belongs to user
    const existingCase = await db.queryOne<DBCase>(
      `SELECT id, name FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!existingCase) {
      throw new NotFoundError('Case', caseId);
    }

    // Soft delete: Update status to 'dismissed'
    await db.query(
      `UPDATE dl.cases
       SET status = 'dismissed', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    logger.info('Case deleted successfully (soft delete)', {
      userId: user.userId,
      caseId,
      caseName: existingCase.name,
    });

    const response: ApiResponse<{ id: string; message: string }> = {
      success: true,
      data: {
        id: caseId,
        message: 'Case deleted successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default router;
