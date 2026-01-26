/**
 * Geographic Router
 *
 * Geographic analysis, H3 alignment, compactness metrics, and spatial operations
 */

import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/error';
import { getUserContext } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { SpatialService, GeoJSONGeometry, GeoJSONFeature } from '../services/spatial';
import {
  ApiResponse,
  CompactnessMetrics,
  H3AlignmentResult,
  ValidationError,
  NotFoundError,
  DBGeographicData,
} from '../types';
import { logger } from '../server';

const router = Router();
const db = DatabaseService.getInstance();
const spatialService = SpatialService.getInstance();

/**
 * POST /geo/census-alignment
 * H3-based census-to-precinct alignment
 *
 * Body:
 * - case_id: string UUID (required)
 * - source_features: GeoJSONFeature[] (required, e.g., census blocks)
 * - target_features: GeoJSONFeature[] (required, e.g., precincts)
 * - resolution: number (required, H3 resolution 0-15, typically 9)
 * - source_id_field: string (optional, default: 'id')
 * - target_id_field: string (optional, default: 'id')
 *
 * Returns: Crosswalk table with weights and quality metrics
 */
router.post(
  '/census-alignment',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.body.case_id as string;
    const sourceFeatures = req.body.source_features as GeoJSONFeature[];
    const targetFeatures = req.body.target_features as GeoJSONFeature[];
    const resolution = req.body.resolution as number;
    const sourceIdField = req.body.source_id_field as string | undefined;
    const targetIdField = req.body.target_id_field as string | undefined;

    // Validate required fields
    if (!caseId || !sourceFeatures || !targetFeatures || resolution === undefined) {
      throw new ValidationError(
        'Missing required fields: case_id, source_features, target_features, resolution'
      );
    }

    if (!Array.isArray(sourceFeatures) || !Array.isArray(targetFeatures)) {
      throw new ValidationError('source_features and target_features must be arrays');
    }

    if (resolution < 0 || resolution > 15) {
      throw new ValidationError('resolution must be between 0 and 15');
    }

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    logger.info('Performing H3 census alignment', {
      userId: user.userId,
      caseId,
      sourceCount: sourceFeatures.length,
      targetCount: targetFeatures.length,
      resolution,
    });

    // Perform alignment
    const alignment = await spatialService.alignH3({
      sourceFeatures,
      targetFeatures,
      resolution,
      sourceIdField,
      targetIdField,
    });

    // Store crosswalk in database
    await db.query(
      `INSERT INTO dl.geographic_data (
        case_id, data_type, geometry, properties
      ) VALUES ($1, $2, NULL, $3)`,
      [
        caseId,
        'h3_crosswalk',
        JSON.stringify({
          crosswalk: alignment.crosswalk,
          quality_metrics: alignment.quality_metrics,
          resolution,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    logger.info('H3 census alignment completed', {
      userId: user.userId,
      caseId,
      crosswalkSize: alignment.crosswalk.length,
      coverage: alignment.quality_metrics.coverage,
    });

    const response: ApiResponse<H3AlignmentResult> = {
      success: true,
      data: alignment,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /geo/compactness
 * Calculate compactness metrics for a district
 *
 * Body:
 * - case_id: string UUID (required)
 * - geometry: GeoJSONGeometry (required, district boundary)
 * - district_id: string (optional, for tracking)
 *
 * Returns: Polsby-Popper, Reock, and Convex Hull metrics
 */
router.post(
  '/compactness',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.body.case_id as string;
    const geometry = req.body.geometry as GeoJSONGeometry;
    const districtId = req.body.district_id as string | undefined;

    if (!caseId || !geometry) {
      throw new ValidationError('Missing required fields: case_id, geometry');
    }

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    logger.info('Calculating compactness metrics', {
      userId: user.userId,
      caseId,
      districtId,
      geometryType: geometry.type,
    });

    // Calculate metrics
    const metrics = await spatialService.calculateCompactness(geometry);

    // Store in compactness_metrics table
    await db.query(
      `INSERT INTO dl.compactness_metrics (
        case_id, district_id, geometry, polsby_popper, reock, convex_hull_ratio
      ) VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6)`,
      [
        caseId,
        districtId || 'unknown',
        JSON.stringify(geometry),
        metrics.polsby_popper,
        metrics.reock,
        metrics.convex_hull_ratio,
      ]
    );

    logger.info('Compactness metrics calculated', {
      userId: user.userId,
      caseId,
      districtId,
      metrics: {
        polsbyPopper: metrics.polsby_popper.toFixed(4),
        reock: metrics.reock.toFixed(4),
        convexHullRatio: metrics.convex_hull_ratio.toFixed(4),
      },
    });

    const response: ApiResponse<CompactnessMetrics> = {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /geo/buffer
 * Buffer analysis (create zone around geometry)
 *
 * Body:
 * - geometry: GeoJSONGeometry (required)
 * - radius: number (required, in meters)
 * - units: string (optional, default: 'meters', can be 'kilometers', 'miles', etc.)
 *
 * Returns: Buffered geometry and area
 */
router.post(
  '/buffer',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const geometry = req.body.geometry as GeoJSONGeometry;
    const radius = req.body.radius as number;
    const units = req.body.units as string | undefined;

    if (!geometry || radius === undefined) {
      throw new ValidationError('Missing required fields: geometry, radius');
    }

    if (radius <= 0) {
      throw new ValidationError('radius must be greater than 0');
    }

    logger.info('Performing buffer analysis', {
      userId: user.userId,
      geometryType: geometry.type,
      radius,
      units: units || 'meters',
    });

    // Perform buffer analysis
    const bufferResult = await spatialService.bufferAnalysis({
      geometry,
      radius,
      units: units as any,
    });

    logger.info('Buffer analysis completed', {
      userId: user.userId,
      bufferArea: bufferResult.area.toFixed(2),
    });

    const response: ApiResponse<typeof bufferResult> = {
      success: true,
      data: bufferResult,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * POST /geo/intersection
 * Spatial intersection analysis
 *
 * Body:
 * - geometry1: GeoJSONGeometry (required)
 * - geometry2: GeoJSONGeometry (required)
 *
 * Returns: Intersection geometry, area, and overlap percentage
 */
router.post(
  '/intersection',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const geometry1 = req.body.geometry1 as GeoJSONGeometry;
    const geometry2 = req.body.geometry2 as GeoJSONGeometry;

    if (!geometry1 || !geometry2) {
      throw new ValidationError('Missing required fields: geometry1, geometry2');
    }

    logger.info('Calculating spatial intersection', {
      userId: user.userId,
      geometry1Type: geometry1.type,
      geometry2Type: geometry2.type,
    });

    // Calculate intersection
    const intersectionResult = await spatialService.spatialIntersection({
      geometry1,
      geometry2,
    });

    logger.info('Spatial intersection completed', {
      userId: user.userId,
      intersectionArea: intersectionResult.area.toFixed(2),
      overlapPercentage: intersectionResult.overlapPercentage.toFixed(2),
    });

    const response: ApiResponse<typeof intersectionResult> = {
      success: true,
      data: intersectionResult,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

/**
 * GET /geo/data/:caseId
 * Get all geographic data for a case
 *
 * Params:
 * - caseId: string (UUID)
 *
 * Query params:
 * - data_type: string (optional filter: 'h3_crosswalk', 'district_boundary', etc.)
 *
 * Returns: Array of geographic data records
 */
router.get(
  '/data/:caseId',
  asyncHandler(async (req: Request, res) => {
    const user = getUserContext(req)!;
    const caseId = req.params.caseId;
    const dataType = req.query.data_type as string | undefined;

    logger.info('Getting geographic data', {
      userId: user.userId,
      caseId,
      dataType,
    });

    // Verify case exists and belongs to user
    const caseExists = await db.queryOne<{ id: string }>(
      `SELECT id FROM dl.cases WHERE id = $1 AND user_id = $2`,
      [caseId, user.userId]
    );

    if (!caseExists) {
      throw new NotFoundError('Case', caseId);
    }

    // Build query
    let query = `
      SELECT
        id, case_id, data_type,
        ST_AsGeoJSON(geometry) as geometry,
        properties, h3_resolution9, created_at
      FROM dl.geographic_data
      WHERE case_id = $1
    `;
    const params: any[] = [caseId];

    if (dataType) {
      query += ` AND data_type = $2`;
      params.push(dataType);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query<{
      id: string;
      case_id: string;
      data_type: string;
      geometry: string | null;
      properties: Record<string, unknown>;
      h3_resolution9: string | null;
      created_at: Date;
    }>(query, params);

    // Parse GeoJSON strings
    const geoData = result.rows.map((row) => ({
      ...row,
      geometry: row.geometry ? JSON.parse(row.geometry) : null,
    }));

    logger.info('Geographic data retrieved', {
      userId: user.userId,
      caseId,
      count: geoData.length,
    });

    const response: ApiResponse<typeof geoData> = {
      success: true,
      data: geoData,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default router;
