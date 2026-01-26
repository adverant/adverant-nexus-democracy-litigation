/**
 * GeoAgent Integration Hook
 *
 * Provides methods for interacting with GeoAgent geographic analysis APIs
 * directly (when not using iframe embedding).
 *
 * This hook enables Democracy Litigation plugin to call GeoAgent's backend
 * services for:
 * - Compactness analysis (Polsby-Popper, Reock, convex hull)
 * - H3-based geographic alignment (Census blocks to precincts)
 * - Buffer analysis (spatial buffer operations)
 *
 * All methods use the user's auth token from the dashboard store and
 * implement proper error handling with typed responses.
 *
 * @see /Users/don/.claude/plans/starry-finding-aurora.md
 */

import { useCallback } from 'react';
import { useAuthToken } from '@/stores/dashboard-store';

// ============================================
// TypeScript Interfaces
// ============================================

/**
 * Compactness metrics for a district or geographic boundary.
 * Used for Gingles I prong analysis (numerosity & compactness).
 */
export interface CompactnessMetrics {
  /**
   * Polsby-Popper score (0-1, higher = more compact)
   * Formula: 4π × Area / Perimeter²
   * VRA threshold typically 0.15-0.20
   */
  polsby_popper: number;

  /**
   * Reock score (0-1, higher = more compact)
   * Formula: Area / Area of minimum bounding circle
   * VRA threshold typically 0.20-0.30
   */
  reock: number;

  /**
   * Convex hull ratio (0-1, higher = more compact)
   * Formula: Area / Area of convex hull
   * Detects indentation and fragmentation
   */
  convex_hull_ratio: number;

  /**
   * Optional metadata about the calculation
   */
  metadata?: {
    area_square_meters?: number;
    perimeter_meters?: number;
    min_bounding_circle_radius_meters?: number;
    convex_hull_area_square_meters?: number;
  };
}

/**
 * Result of H3-based geographic alignment between two datasets.
 * Used to align Census blocks to precincts for demographic analysis.
 */
export interface H3AlignmentResult {
  /**
   * Crosswalk table mapping source features to target features
   * with population weights.
   */
  crosswalk: Array<{
    /**
     * Source feature ID (e.g., Census block GEOID)
     */
    census_block_id: string;

    /**
     * Target feature ID (e.g., precinct ID)
     */
    precinct_id: string;

    /**
     * Population weight (0-1) representing allocation ratio
     * When Census block overlaps multiple precincts, this determines
     * how to split the population.
     */
    population_weight: number;

    /**
     * Optional: H3 cell ID at the resolution used for alignment
     */
    h3_cell_id?: string;
  }>;

  /**
   * Quality metrics for the alignment
   */
  quality_metrics: {
    /**
     * Coverage percentage (0-100)
     * What percentage of source area is covered by target
     */
    coverage: number;

    /**
     * Accuracy score (0-100)
     * Confidence in the alignment based on geometric overlap
     */
    accuracy: number;

    /**
     * Total features aligned
     */
    total_source_features?: number;
    total_target_features?: number;

    /**
     * H3 resolution used
     */
    h3_resolution?: number;
  };
}

/**
 * Request parameters for compactness calculation
 */
export interface CompactnessRequest {
  /**
   * GeoJSON geometry to analyze (Polygon or MultiPolygon)
   */
  geometry: GeoJSON.Geometry;

  /**
   * Which metrics to calculate
   * Default: all three
   */
  metrics?: Array<'polsby_popper' | 'reock' | 'convex_hull'>;
}

/**
 * Request parameters for H3 alignment
 */
export interface H3AlignmentRequest {
  /**
   * Source dataset (e.g., Census blocks)
   */
  source: GeoJSON.FeatureCollection;

  /**
   * Target dataset (e.g., precincts)
   */
  target: GeoJSON.FeatureCollection;

  /**
   * H3 resolution (0-15, typically 8-10 for VRA analysis)
   * Higher = more precise but slower
   * - Resolution 8: ~0.46 km² per cell
   * - Resolution 9: ~0.10 km² per cell (recommended)
   * - Resolution 10: ~0.02 km² per cell
   */
  resolution: number;

  /**
   * Optional: Property names to use for feature IDs
   */
  source_id_property?: string;
  target_id_property?: string;
}

/**
 * Request parameters for buffer analysis
 */
export interface BufferRequest {
  /**
   * GeoJSON geometry to buffer
   */
  geometry: GeoJSON.Geometry;

  /**
   * Buffer radius in meters
   */
  radius: number;

  /**
   * Optional: Number of segments in the buffer (default 8)
   * Higher = smoother but slower
   */
  segments?: number;
}

/**
 * Response from buffer analysis
 */
export interface BufferResult {
  /**
   * Buffered geometry (always Polygon or MultiPolygon)
   */
  buffered_geometry: GeoJSON.Geometry;

  /**
   * Area of buffered geometry in square meters
   */
  area_square_meters: number;

  /**
   * Original geometry area in square meters
   */
  original_area_square_meters: number;
}

/**
 * Error response from GeoAgent API
 */
export interface GeoAgentError {
  error: string;
  message: string;
  status: number;
  details?: unknown;
}

// ============================================
// Custom Error Class
// ============================================

/**
 * Typed error for GeoAgent API failures
 */
export class GeoAgentAPIError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'GeoAgentAPIError';
    this.status = status;
    this.details = details;
  }
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for GeoAgent API integration
 *
 * Provides three core methods:
 * 1. calculateCompactness - VRA compactness metrics
 * 2. alignH3 - Census-to-precinct alignment
 * 3. bufferAnalysis - Spatial buffer operations
 *
 * @example
 * ```typescript
 * const { calculateCompactness, alignH3 } = useGeoAgentIntegration();
 *
 * // Calculate district compactness
 * const metrics = await calculateCompactness({
 *   geometry: districtBoundary,
 *   metrics: ['polsby_popper', 'reock']
 * });
 *
 * // Align Census blocks to precincts
 * const alignment = await alignH3({
 *   source: censusBlocks,
 *   target: precincts,
 *   resolution: 9
 * });
 * ```
 */
export function useGeoAgentIntegration() {
  const token = useAuthToken();

  /**
   * Calculate compactness metrics for a district boundary
   *
   * Used for Gingles I analysis - a district must be compact enough
   * to satisfy the first prong of the Gingles test.
   *
   * @param request - Compactness calculation parameters
   * @returns Promise<CompactnessMetrics>
   * @throws GeoAgentAPIError if calculation fails
   *
   * @example
   * ```typescript
   * const metrics = await calculateCompactness({
   *   geometry: {
   *     type: 'Polygon',
   *     coordinates: [[[...]]]
   *   },
   *   metrics: ['polsby_popper', 'reock', 'convex_hull']
   * });
   *
   * console.log(metrics.polsby_popper); // 0.234
   * console.log(metrics.reock);         // 0.456
   * ```
   */
  const calculateCompactness = useCallback(
    async (request: CompactnessRequest): Promise<CompactnessMetrics> => {
      if (!token) {
        throw new GeoAgentAPIError('Authentication required', 401);
      }

      try {
        const response = await fetch('/api/data-explorer/geo/compactness', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            geometry: request.geometry,
            metrics: request.metrics || ['polsby_popper', 'reock', 'convex_hull'],
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as GeoAgentError;
          throw new GeoAgentAPIError(
            errorData.message || 'Compactness calculation failed',
            response.status,
            errorData.details
          );
        }

        const data = await response.json();
        return data.metrics as CompactnessMetrics;
      } catch (error) {
        if (error instanceof GeoAgentAPIError) {
          throw error;
        }
        throw new GeoAgentAPIError(
          `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0
        );
      }
    },
    [token]
  );

  /**
   * Align Census blocks to precincts using H3 spatial indexing
   *
   * Used to create crosswalk tables for demographic analysis when
   * Census block boundaries don't align with precinct boundaries.
   *
   * H3 hexagons provide a common spatial index for aggregating
   * population data across misaligned boundaries.
   *
   * @param request - H3 alignment parameters
   * @returns Promise<H3AlignmentResult>
   * @throws GeoAgentAPIError if alignment fails
   *
   * @example
   * ```typescript
   * const result = await alignH3({
   *   source: censusBlocksGeoJSON,
   *   target: precinctsGeoJSON,
   *   resolution: 9, // ~0.10 km² per H3 cell
   *   source_id_property: 'GEOID',
   *   target_id_property: 'PRECINCT_ID'
   * });
   *
   * // Use crosswalk to allocate Census population to precincts
   * result.crosswalk.forEach(row => {
   *   const allocatedPop = censusData[row.census_block_id].population * row.population_weight;
   *   precinctData[row.precinct_id].population += allocatedPop;
   * });
   * ```
   */
  const alignH3 = useCallback(
    async (request: H3AlignmentRequest): Promise<H3AlignmentResult> => {
      if (!token) {
        throw new GeoAgentAPIError('Authentication required', 401);
      }

      try {
        const response = await fetch('/api/data-explorer/geo/h3-align', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: request.source,
            target: request.target,
            resolution: request.resolution,
            source_id_property: request.source_id_property,
            target_id_property: request.target_id_property,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as GeoAgentError;
          throw new GeoAgentAPIError(
            errorData.message || 'H3 alignment failed',
            response.status,
            errorData.details
          );
        }

        return (await response.json()) as H3AlignmentResult;
      } catch (error) {
        if (error instanceof GeoAgentAPIError) {
          throw error;
        }
        throw new GeoAgentAPIError(
          `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0
        );
      }
    },
    [token]
  );

  /**
   * Perform buffer analysis on a geometry
   *
   * Used for spatial proximity analysis, such as:
   * - Finding all voters within X meters of a polling location
   * - Analyzing communities of interest around geographic features
   * - Creating buffer zones for legal standing analysis
   *
   * @param request - Buffer analysis parameters
   * @returns Promise<BufferResult>
   * @throws GeoAgentAPIError if buffer analysis fails
   *
   * @example
   * ```typescript
   * const result = await bufferAnalysis({
   *   geometry: pollingLocationPoint,
   *   radius: 1600, // 1 mile in meters
   *   segments: 16  // Smooth buffer
   * });
   *
   * // result.buffered_geometry is a Polygon representing 1-mile radius
   * ```
   */
  const bufferAnalysis = useCallback(
    async (request: BufferRequest): Promise<BufferResult> => {
      if (!token) {
        throw new GeoAgentAPIError('Authentication required', 401);
      }

      try {
        const response = await fetch('/api/data-explorer/geo/buffer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            geometry: request.geometry,
            radius: request.radius,
            segments: request.segments || 8,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as GeoAgentError;
          throw new GeoAgentAPIError(
            errorData.message || 'Buffer analysis failed',
            response.status,
            errorData.details
          );
        }

        const data = await response.json();
        return {
          buffered_geometry: data.buffered_geometry,
          area_square_meters: data.area_square_meters,
          original_area_square_meters: data.original_area_square_meters,
        } as BufferResult;
      } catch (error) {
        if (error instanceof GeoAgentAPIError) {
          throw error;
        }
        throw new GeoAgentAPIError(
          `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0
        );
      }
    },
    [token]
  );

  return {
    calculateCompactness,
    alignH3,
    bufferAnalysis,
  };
}
