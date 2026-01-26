/**
 * Research Router
 *
 * VRA precedent research, circuit comparison, and GraphRAG integration
 */

import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/error';
import { getUserContext, requireRole } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { GraphRAGService } from '../services/graphrag';
import {
  ApiResponse,
  PaginatedResponse,
  DBPrecedent,
  GraphRAGSearchResult,
  CircuitComparison,
  GinglesIssue,
  SenateFactor,
  ValidationError,
  NotFoundError,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const graphRAG = GraphRAGService.getInstance();

/**
 * POST /research/vra-search
 * Search VRA precedents via GraphRAG
 *
 * Body:
 * - query: string (required, natural language query)
 * - gingles_issues: GinglesIssue[] (optional)
 * - senate_factors: SenateFactor[] (optional)
 * - circuits: string[] (optional, e.g., ['1st', '5th', '11th'])
 * - date_from: ISO date string (optional)
 * - date_to: ISO date string (optional)
 * - limit: number (optional, default: 20, max: 100)
 *
 * Returns: Precedents with relevance scores
 */
router.post(
  '/vra-search',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const query = req.body.query as string;
    const ginglesIssues = req.body.gingles_issues as GinglesIssue[] | undefined;
    const senateFactors = req.body.senate_factors as SenateFactor[] | undefined;
    const circuits = req.body.circuits as string[] | undefined;
    const dateFrom = req.body.date_from as string | undefined;
    const dateTo = req.body.date_to as string | undefined;
    const limit = req.body.limit ? parseInt(req.body.limit) : 20;

    if (!query) {
      throw new ValidationError('Missing required field: query');
    }

    logger.info('Searching VRA precedents', {
      userId: user.userId,
      query: query.substring(0, 100),
      filters: { ginglesIssues, senateFactors, circuits, dateFrom, dateTo },
      limit,
    });

    // Search via GraphRAG
    const searchResults = await graphRAG.searchVRAPrecedents({
      query,
      ginglesIssues,
      senateFactors,
      circuits,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: Math.min(limit, 100),
    });

    logger.info('VRA search completed', {
      userId: user.userId,
      resultsCount: searchResults.precedents.length,
      total: searchResults.total,
    });

    const response: ApiResponse<GraphRAGSearchResult> = {
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /research/circuit-compare
 * Compare circuits on a specific issue
 *
 * Body:
 * - issue: GinglesIssue | SenateFactor (required)
 * - circuits: string[] (required, e.g., ['1st', '5th', '11th'])
 * - date_from: ISO date string (optional)
 * - date_to: ISO date string (optional)
 *
 * Returns: Circuit comparison with success rates and key precedents
 */
router.post(
  '/circuit-compare',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const issue = req.body.issue as GinglesIssue | SenateFactor;
    const circuits = req.body.circuits as string[];
    const dateFrom = req.body.date_from as string | undefined;
    const dateTo = req.body.date_to as string | undefined;

    if (!issue || !circuits || !Array.isArray(circuits) || circuits.length === 0) {
      throw new ValidationError('Missing required fields: issue, circuits (array)');
    }

    logger.info('Comparing circuits', {
      userId: user.userId,
      issue,
      circuits,
      dateRange: { dateFrom, dateTo },
    });

    // Compare via GraphRAG
    const comparison = await graphRAG.compareCircuits({
      issue,
      circuits,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    logger.info('Circuit comparison completed', {
      userId: user.userId,
      issue,
      circuitsAnalyzed: comparison.circuits.length,
    });

    const response: ApiResponse<CircuitComparison> = {
      success: true,
      data: comparison,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * GET /research/precedents
 * List all precedents from database
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - circuit: string (optional filter)
 * - gingles_issue: GinglesIssue (optional filter)
 * - senate_factor: SenateFactor (optional filter)
 * - search: string (optional, search case_name and citation)
 *
 * Returns: Paginated list of precedents
 */
router.get(
  '/precedents',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const circuit = req.query.circuit as string | undefined;
    const ginglesIssue = req.query.gingles_issue as GinglesIssue | undefined;
    const senateFactor = req.query.senate_factor as SenateFactor | undefined;
    const search = req.query.search as string | undefined;

    logger.info('Listing precedents', {
      userId: user.userId,
      page,
      limit,
      filters: { circuit, ginglesIssue, senateFactor, search },
    });

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (circuit) {
      conditions.push(`circuit = $${paramIndex}`);
      params.push(circuit);
      paramIndex++;
    }

    if (ginglesIssue) {
      conditions.push(`$${paramIndex} = ANY(gingles_issues)`);
      params.push(ginglesIssue);
      paramIndex++;
    }

    if (senateFactor) {
      conditions.push(`$${paramIndex} = ANY(senate_factors)`);
      params.push(senateFactor);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(case_name ILIKE $${paramIndex} OR citation ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dl.precedents ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Calculate pagination
    const { limit: sanitizedLimit, offset } = DatabaseService.buildPaginationClause(page, limit);
    const totalPages = Math.ceil(total / sanitizedLimit);

    // Get precedents
    const precedentsResult = await db.query<DBPrecedent>(
      `SELECT
        id, case_name, citation, circuit, court_level, decision_date,
        gingles_issues, senate_factors, holding, majority_opinion_text,
        dissenting_opinion_text, metadata, created_at
       FROM dl.precedents
       ${whereClause}
       ORDER BY decision_date DESC NULLS LAST, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, sanitizedLimit, offset]
    );

    const response: ApiResponse<PaginatedResponse<DBPrecedent>> = {
      success: true,
      data: {
        data: precedentsResult.rows,
        pagination: {
          page,
          limit: sanitizedLimit,
          total,
          total_pages: totalPages,
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Precedents listed successfully', {
      userId: user.userId,
      count: precedentsResult.rows.length,
      total,
    });

    res.json(response);
  })
);

/**
 * GET /research/precedents/:id
 * Get precedent by ID
 *
 * Params:
 * - id: string (UUID)
 *
 * Returns: Precedent details
 */
router.get(
  '/precedents/:id',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const precedentId = req.params.id;

    logger.info('Getting precedent', {
      userId: user.userId,
      precedentId,
    });

    const result = await db.query<DBPrecedent>(
      `SELECT
        id, case_name, citation, circuit, court_level, decision_date,
        gingles_issues, senate_factors, holding, majority_opinion_text,
        dissenting_opinion_text, metadata, created_at
       FROM dl.precedents
       WHERE id = $1`,
      [precedentId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Precedent', precedentId);
    }

    const precedent = result.rows[0];

    logger.info('Precedent retrieved successfully', {
      userId: user.userId,
      precedentId,
    });

    const response: ApiResponse<DBPrecedent> = {
      success: true,
      data: precedent,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /research/precedents
 * Add new precedent to database and GraphRAG (admin only)
 *
 * Body:
 * - case_name: string (required)
 * - citation: string (required)
 * - circuit: string (optional)
 * - court_level: string (optional)
 * - decision_date: ISO date string (optional)
 * - gingles_issues: GinglesIssue[] (optional)
 * - senate_factors: SenateFactor[] (optional)
 * - holding: string (optional)
 * - majority_opinion_text: string (optional)
 * - dissenting_opinion_text: string (optional)
 *
 * Returns: Created precedent with embedding
 */
router.post(
  '/precedents',
  requireRole('admin'),
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseName = req.body.case_name as string;
    const citation = req.body.citation as string;
    const circuit = req.body.circuit as string | undefined;
    const courtLevel = req.body.court_level as string | undefined;
    const decisionDate = req.body.decision_date as string | undefined;
    const ginglesIssues = req.body.gingles_issues as GinglesIssue[] | undefined;
    const senateFactors = req.body.senate_factors as SenateFactor[] | undefined;
    const holding = req.body.holding as string | undefined;
    const majorityOpinionText = req.body.majority_opinion_text as string | undefined;
    const dissentingOpinionText = req.body.dissenting_opinion_text as string | undefined;

    if (!caseName || !citation) {
      throw new ValidationError('Missing required fields: case_name, citation');
    }

    logger.info('Adding precedent (admin)', {
      userId: user.userId,
      caseName,
      citation,
    });

    // Ingest to GraphRAG (which also generates embedding)
    const precedent = await graphRAG.ingestPrecedent({
      caseName,
      citation,
      circuit,
      courtLevel,
      decisionDate: decisionDate ? new Date(decisionDate) : undefined,
      ginglesIssues,
      senateFactors,
      holding,
      majorityOpinionText,
      dissentingOpinionText,
      metadata: {
        added_by: user.userId,
        added_at: new Date().toISOString(),
      },
    });

    // Also insert into local database
    await db.query(
      `INSERT INTO dl.precedents (
        id, case_name, citation, circuit, court_level, decision_date,
        gingles_issues, senate_factors, holding, majority_opinion_text,
        dissenting_opinion_text, embedding, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        case_name = EXCLUDED.case_name,
        citation = EXCLUDED.citation,
        updated_at = NOW()`,
      [
        precedent.id,
        precedent.case_name,
        precedent.citation,
        precedent.circuit,
        precedent.court_level,
        precedent.decision_date,
        precedent.gingles_issues,
        precedent.senate_factors,
        precedent.holding,
        precedent.majority_opinion_text,
        precedent.dissenting_opinion_text,
        precedent.embedding ? JSON.stringify(precedent.embedding) : null,
        precedent.metadata,
      ]
    );

    logger.info('Precedent added successfully', {
      userId: user.userId,
      precedentId: precedent.id,
      caseName: precedent.case_name,
    });

    const response: ApiResponse<DBPrecedent> = {
      success: true,
      data: precedent,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  })
);

export default router;
