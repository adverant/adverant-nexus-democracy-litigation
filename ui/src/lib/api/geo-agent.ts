/**
 * GeoAgent API Client
 *
 * Type-safe client for GeoAgent backend APIs.
 * Provides methods for geographic analysis, compactness calculations,
 * H3 alignment, and spatial operations.
 *
 * @module geo-agent-client
 */

import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const LONG_TIMEOUT_MS = 120000; // 2 minutes for heavy operations
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.adverant.ai';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Compactness metrics for district analysis
 */
export interface CompactnessMetrics {
  /** Polsby-Popper score (0-1, higher is more compact) */
  polsby_popper: number;
  /** Reock score (0-1, higher is more compact) */
  reock: number;
  /** Convex hull ratio (0-1, higher is more compact) */
  convex_hull_ratio: number;
  /** Schwartzberg score (1+, lower is more compact) */
  schwartzberg?: number;
  /** Length-width ratio (1+, lower is more compact) */
  length_width_ratio?: number;
}

/**
 * H3 alignment result with crosswalk table
 */
export interface H3AlignmentResult {
  /** Crosswalk table mapping source to target geographies */
  crosswalk: Array<{
    source_id: string;
    target_id: string;
    h3_index: string;
    population_weight: number;
    area_weight: number;
  }>;
  /** Quality metrics for the alignment */
  quality_metrics: {
    /** Coverage percentage (0-100) */
    coverage: number;
    /** Accuracy score (0-1) */
    accuracy: number;
    /** Total H3 hexagons used */
    hexagon_count: number;
  };
  /** H3 resolution used */
  resolution: number;
}

/**
 * Buffer analysis result
 */
export interface BufferAnalysisResult {
  /** Buffered geometry */
  buffered_geometry: Geometry;
  /** Original area in square kilometers */
  original_area_sqkm: number;
  /** Buffered area in square kilometers */
  buffered_area_sqkm: number;
  /** Buffer radius in meters */
  radius_meters: number;
}

/**
 * Spatial intersection result
 */
export interface SpatialIntersectionResult {
  /** Intersecting features */
  features: Feature[];
  /** Total intersection area in square kilometers */
  total_area_sqkm: number;
  /** Number of intersecting features */
  count: number;
}

/**
 * Spatial union result
 */
export interface SpatialUnionResult {
  /** Unioned geometry */
  geometry: Geometry;
  /** Total area in square kilometers */
  area_sqkm: number;
  /** Original feature count */
  original_count: number;
}

/**
 * Distance calculation result
 */
export interface DistanceResult {
  /** Distance in meters */
  distance_meters: number;
  /** Distance in kilometers */
  distance_km: number;
  /** Distance in miles */
  distance_miles: number;
}

/**
 * Centroid calculation result
 */
export interface CentroidResult {
  /** Centroid point */
  centroid: Point;
  /** Distance from geometric center to centroid (meters) */
  deviation_meters: number;
}

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Error class for GeoAgent API errors
 */
export class GeoAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GeoAgentError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GeoAgentError);
    }
  }

  /**
   * Create error from HTTP response
   */
  static fromResponse(
    statusCode: number,
    data: { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
  ): GeoAgentError {
    return new GeoAgentError(
      data?.error?.message || `HTTP ${statusCode}`,
      data?.error?.code || 'HTTP_ERROR',
      statusCode,
      data?.error?.details
    );
  }
}

// ============================================================================
// GeoAgent Client Class
// ============================================================================

/**
 * API client for GeoAgent geographic analysis service
 */
export class GeoAgentClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;

  constructor(
    token: string,
    options?: {
      baseUrl?: string;
      timeout?: number;
    }
  ) {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Invalid token: Token must be a non-empty string');
    }

    this.token = token;
    this.baseUrl = options?.baseUrl || API_BASE_URL;
    this.timeout = options?.timeout || DEFAULT_TIMEOUT_MS;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Generic request handler with error handling and timeout
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options?: { timeout?: number }
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout || this.timeout
    );

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json();

      // Handle errors
      if (!response.ok) {
        throw GeoAgentError.fromResponse(response.status, data);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeoAgentError(
          'Request timeout',
          'TIMEOUT',
          408,
          { timeout: options?.timeout || this.timeout }
        );
      }

      // Handle network errors
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new GeoAgentError(
          'Network error',
          'NETWORK_ERROR',
          0,
          { originalError: error.message }
        );
      }

      // Re-throw GeoAgentError
      if (error instanceof GeoAgentError) {
        throw error;
      }

      // Wrap unknown errors
      throw new GeoAgentError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR',
        500,
        { originalError: String(error) }
      );
    }
  }

  // ==========================================================================
  // Compactness Analysis
  // ==========================================================================

  /**
   * Calculate compactness metrics for a given geometry
   *
   * @param params - Parameters for compactness calculation
   * @returns Compactness metrics
   *
   * @example
   * ```typescript
   * const metrics = await client.calculateCompactness({
   *   geometry: districtGeoJSON,
   *   metrics: ['polsby_popper', 'reock', 'convex_hull']
   * });
   * console.log('Polsby-Popper:', metrics.polsby_popper);
   * ```
   */
  async calculateCompactness(params: {
    geometry: Geometry;
    metrics: string[];
  }): Promise<CompactnessMetrics> {
    return this.request<CompactnessMetrics>(
      'POST',
      '/data-explorer/geo/compactness',
      params,
      { timeout: LONG_TIMEOUT_MS }
    );
  }

  // ==========================================================================
  // H3 Hexagonal Grid Operations
  // ==========================================================================

  /**
   * Align two geographic datasets using H3 hexagonal grid
   *
   * @param params - Parameters for H3 alignment
   * @returns Alignment result with crosswalk table
   *
   * @example
   * ```typescript
   * const alignment = await client.alignH3({
   *   source: censusBlocks,
   *   target: precincts,
   *   resolution: 9
   * });
   * console.log('Coverage:', alignment.quality_metrics.coverage);
   * ```
   */
  async alignH3(params: {
    source: FeatureCollection;
    target: FeatureCollection;
    resolution: number;
  }): Promise<H3AlignmentResult> {
    return this.request<H3AlignmentResult>(
      'POST',
      '/data-explorer/geo/h3-align',
      params,
      { timeout: LONG_TIMEOUT_MS }
    );
  }

  /**
   * Convert geometry to H3 hexagons
   *
   * @param params - Parameters for H3 conversion
   * @returns H3 indexes and their properties
   *
   * @example
   * ```typescript
   * const hexagons = await client.geometryToH3({
   *   geometry: district,
   *   resolution: 9
   * });
   * ```
   */
  async geometryToH3(params: {
    geometry: Geometry;
    resolution: number;
  }): Promise<{
    h3_indexes: string[];
    resolution: number;
    coverage_area_sqkm: number;
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/geometry-to-h3',
      params
    );
  }

  /**
   * Convert H3 hexagons to GeoJSON
   *
   * @param params - Parameters for H3 to geometry conversion
   * @returns GeoJSON FeatureCollection of hexagons
   *
   * @example
   * ```typescript
   * const geojson = await client.h3ToGeometry({
   *   h3_indexes: ['891e2040003ffff', '891e2040007ffff'],
   *   resolution: 9
   * });
   * ```
   */
  async h3ToGeometry(params: {
    h3_indexes: string[];
    resolution: number;
  }): Promise<FeatureCollection> {
    return this.request(
      'POST',
      '/data-explorer/geo/h3-to-geometry',
      params
    );
  }

  // ==========================================================================
  // Spatial Operations
  // ==========================================================================

  /**
   * Create buffer around geometry
   *
   * @param params - Parameters for buffer analysis
   * @returns Buffered geometry with area metrics
   *
   * @example
   * ```typescript
   * const buffered = await client.bufferAnalysis({
   *   geometry: pointLocation,
   *   radiusMeters: 5000
   * });
   * ```
   */
  async bufferAnalysis(params: {
    geometry: Geometry;
    radiusMeters: number;
  }): Promise<BufferAnalysisResult> {
    return this.request(
      'POST',
      '/data-explorer/geo/buffer',
      {
        geometry: params.geometry,
        radius: params.radiusMeters,
      }
    );
  }

  /**
   * Calculate intersection of two geometries
   *
   * @param params - Parameters for intersection
   * @returns Intersection result
   *
   * @example
   * ```typescript
   * const intersection = await client.spatialIntersection({
   *   geometry1: district,
   *   geometry2: county
   * });
   * ```
   */
  async spatialIntersection(params: {
    geometry1: Geometry;
    geometry2: Geometry;
  }): Promise<SpatialIntersectionResult> {
    return this.request(
      'POST',
      '/data-explorer/geo/intersection',
      params
    );
  }

  /**
   * Calculate union of multiple geometries
   *
   * @param params - Parameters for union
   * @returns Union result
   *
   * @example
   * ```typescript
   * const union = await client.spatialUnion({
   *   geometries: [district1, district2, district3]
   * });
   * ```
   */
  async spatialUnion(params: {
    geometries: Geometry[];
  }): Promise<SpatialUnionResult> {
    return this.request(
      'POST',
      '/data-explorer/geo/union',
      params,
      { timeout: LONG_TIMEOUT_MS }
    );
  }

  /**
   * Calculate distance between two geometries
   *
   * @param params - Parameters for distance calculation
   * @returns Distance in multiple units
   *
   * @example
   * ```typescript
   * const distance = await client.calculateDistance({
   *   geometry1: point1,
   *   geometry2: point2
   * });
   * console.log('Distance:', distance.distance_km, 'km');
   * ```
   */
  async calculateDistance(params: {
    geometry1: Geometry;
    geometry2: Geometry;
  }): Promise<DistanceResult> {
    return this.request(
      'POST',
      '/data-explorer/geo/distance',
      params
    );
  }

  /**
   * Calculate centroid of geometry
   *
   * @param params - Parameters for centroid calculation
   * @returns Centroid point
   *
   * @example
   * ```typescript
   * const result = await client.calculateCentroid({
   *   geometry: district
   * });
   * console.log('Centroid:', result.centroid.coordinates);
   * ```
   */
  async calculateCentroid(params: {
    geometry: Geometry;
  }): Promise<CentroidResult> {
    return this.request(
      'POST',
      '/data-explorer/geo/centroid',
      params
    );
  }

  /**
   * Calculate area of geometry
   *
   * @param params - Parameters for area calculation
   * @returns Area in square kilometers
   *
   * @example
   * ```typescript
   * const area = await client.calculateArea({
   *   geometry: district
   * });
   * console.log('Area:', area.area_sqkm, 'km²');
   * ```
   */
  async calculateArea(params: {
    geometry: Geometry;
  }): Promise<{
    area_sqkm: number;
    area_sqmi: number;
    perimeter_km: number;
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/area',
      params
    );
  }

  // ==========================================================================
  // Simplification & Optimization
  // ==========================================================================

  /**
   * Simplify geometry while preserving topology
   *
   * @param params - Parameters for simplification
   * @returns Simplified geometry
   *
   * @example
   * ```typescript
   * const simplified = await client.simplifyGeometry({
   *   geometry: complexPolygon,
   *   tolerance: 0.001
   * });
   * ```
   */
  async simplifyGeometry(params: {
    geometry: Geometry;
    tolerance: number;
    preserveTopology?: boolean;
  }): Promise<{
    simplified_geometry: Geometry;
    original_points: number;
    simplified_points: number;
    reduction_percent: number;
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/simplify',
      params
    );
  }

  /**
   * Validate geometry for errors
   *
   * @param params - Parameters for validation
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const validation = await client.validateGeometry({
   *   geometry: polygon
   * });
   * if (!validation.valid) {
   *   console.log('Errors:', validation.errors);
   * }
   * ```
   */
  async validateGeometry(params: {
    geometry: Geometry;
  }): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/validate',
      params
    );
  }

  // ==========================================================================
  // Geocoding & Address Operations
  // ==========================================================================

  /**
   * Geocode address to coordinates
   *
   * @param params - Parameters for geocoding
   * @returns Geocoding result
   *
   * @example
   * ```typescript
   * const result = await client.geocodeAddress({
   *   address: '1600 Pennsylvania Avenue NW, Washington, DC'
   * });
   * console.log('Location:', result.location.coordinates);
   * ```
   */
  async geocodeAddress(params: {
    address: string;
  }): Promise<{
    location: Point;
    formatted_address: string;
    confidence: number;
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/geocode',
      params
    );
  }

  /**
   * Reverse geocode coordinates to address
   *
   * @param params - Parameters for reverse geocoding
   * @returns Address result
   *
   * @example
   * ```typescript
   * const result = await client.reverseGeocode({
   *   latitude: 38.8977,
   *   longitude: -77.0365
   * });
   * console.log('Address:', result.formatted_address);
   * ```
   */
  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
  }): Promise<{
    formatted_address: string;
    street?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  }> {
    return this.request(
      'POST',
      '/data-explorer/geo/reverse-geocode',
      params
    );
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Calculate compactness for multiple geometries
   *
   * @param params - Parameters for batch compactness
   * @returns Array of compactness results
   *
   * @example
   * ```typescript
   * const results = await client.batchCompactness({
   *   geometries: [district1, district2, district3],
   *   metrics: ['polsby_popper', 'reock']
   * });
   * ```
   */
  async batchCompactness(params: {
    geometries: Array<{ id: string; geometry: Geometry }>;
    metrics: string[];
  }): Promise<
    Array<{
      id: string;
      metrics: CompactnessMetrics;
    }>
  > {
    return this.request(
      'POST',
      '/data-explorer/geo/batch/compactness',
      params,
      { timeout: LONG_TIMEOUT_MS }
    );
  }

  /**
   * Geocode multiple addresses in batch
   *
   * @param params - Parameters for batch geocoding
   * @returns Array of geocoding results
   *
   * @example
   * ```typescript
   * const results = await client.batchGeocode({
   *   addresses: ['123 Main St', '456 Oak Ave']
   * });
   * ```
   */
  async batchGeocode(params: {
    addresses: Array<{ id: string; address: string }>;
  }): Promise<
    Array<{
      id: string;
      location: Point | null;
      formatted_address: string;
      confidence: number;
      error?: string;
    }>
  > {
    return this.request(
      'POST',
      '/data-explorer/geo/batch/geocode',
      params,
      { timeout: LONG_TIMEOUT_MS }
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GeoAgent client instance
 *
 * @param token - Authentication token
 * @param options - Optional configuration
 * @returns GeoAgent client instance
 *
 * @example
 * ```typescript
 * const geoClient = createGeoAgentClient(token, {
 *   baseUrl: 'https://api.adverant.ai',
 *   timeout: 30000
 * });
 *
 * const metrics = await geoClient.calculateCompactness({
 *   geometry: districtGeoJSON,
 *   metrics: ['polsby_popper', 'reock']
 * });
 * ```
 */
export function createGeoAgentClient(
  token: string,
  options?: {
    baseUrl?: string;
    timeout?: number;
  }
): GeoAgentClient {
  return new GeoAgentClient(token, options);
}

// ============================================================================
// Export Everything
// ============================================================================

export default GeoAgentClient;
