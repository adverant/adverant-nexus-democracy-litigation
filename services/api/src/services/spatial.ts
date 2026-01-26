/**
 * Spatial Service
 *
 * H3 hexagonal grid operations and spatial analysis for redistricting cases
 */

import { h3ToGeo, geoToH3, h3ToGeoBoundary, h3GetResolution, h3Distance } from 'h3-js';
import * as turf from '@turf/turf';
import { logger } from '../server';
import { CompactnessMetrics, H3AlignmentResult, APIError } from '../types';

/**
 * GeoJSON geometry types
 */
export interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

/**
 * GeoJSON feature
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: GeoJSONGeometry;
}

/**
 * H3 alignment request
 */
export interface H3AlignmentRequest {
  sourceFeatures: GeoJSONFeature[];
  targetFeatures: GeoJSONFeature[];
  resolution: number;
  sourceIdField?: string;
  targetIdField?: string;
}

/**
 * Buffer analysis request
 */
export interface BufferRequest {
  geometry: GeoJSONGeometry;
  radius: number;
  units?: turf.Units;
}

/**
 * Buffer analysis response
 */
export interface BufferResponse {
  geometry: GeoJSONGeometry;
  area: number;
  units: string;
}

/**
 * Spatial intersection request
 */
export interface IntersectionRequest {
  geometry1: GeoJSONGeometry;
  geometry2: GeoJSONGeometry;
}

/**
 * Spatial intersection response
 */
export interface IntersectionResponse {
  geometry: GeoJSONGeometry | null;
  area: number;
  overlapPercentage: number;
}

/**
 * Spatial Service - H3 and geospatial operations
 */
export class SpatialService {
  private static instance: SpatialService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SpatialService {
    if (!SpatialService.instance) {
      SpatialService.instance = new SpatialService();
    }
    return SpatialService.instance;
  }

  /**
   * Align geographic features using H3 hexagonal grid
   *
   * Creates a crosswalk between source and target features (e.g., census blocks to precincts)
   * using H3 hexagons as an intermediate resolution-independent representation.
   *
   * @param request - Alignment parameters
   * @returns Crosswalk table with weights
   */
  public async alignH3(request: H3AlignmentRequest): Promise<H3AlignmentResult> {
    try {
      logger.info('Starting H3 alignment', {
        sourceCount: request.sourceFeatures.length,
        targetCount: request.targetFeatures.length,
        resolution: request.resolution,
      });

      // Validate resolution (0-15)
      if (request.resolution < 0 || request.resolution > 15) {
        throw new APIError(
          'INVALID_RESOLUTION',
          'H3 resolution must be between 0 and 15',
          400
        );
      }

      const sourceIdField = request.sourceIdField || 'id';
      const targetIdField = request.targetIdField || 'id';

      // Step 1: Convert source features to H3 indices
      const sourceH3Map = new Map<string, Set<string>>();

      for (const feature of request.sourceFeatures) {
        const sourceId = feature.properties[sourceIdField] as string;
        if (!sourceId) continue;

        const h3Indices = this.featureToH3(feature.geometry, request.resolution);
        sourceH3Map.set(sourceId, new Set(h3Indices));
      }

      // Step 2: Convert target features to H3 indices
      const targetH3Map = new Map<string, Set<string>>();

      for (const feature of request.targetFeatures) {
        const targetId = feature.properties[targetIdField] as string;
        if (!targetId) continue;

        const h3Indices = this.featureToH3(feature.geometry, request.resolution);
        targetH3Map.set(targetId, new Set(h3Indices));
      }

      // Step 3: Build crosswalk by finding overlapping H3 cells
      const crosswalk: Array<{
        source_id: string;
        target_id: string;
        h3_index: string;
        weight: number;
      }> = [];

      for (const [sourceId, sourceH3Set] of sourceH3Map.entries()) {
        const sourceSize = sourceH3Set.size;

        for (const [targetId, targetH3Set] of targetH3Map.entries()) {
          // Find intersection of H3 sets
          const intersection = new Set(
            [...sourceH3Set].filter((h3) => targetH3Set.has(h3))
          );

          if (intersection.size > 0) {
            const weight = intersection.size / sourceSize;

            for (const h3Index of intersection) {
              crosswalk.push({
                source_id: sourceId,
                target_id: targetId,
                h3_index: h3Index,
                weight: weight / intersection.size,
              });
            }
          }
        }
      }

      // Step 4: Calculate quality metrics
      const coverageMetric = this.calculateCoverage(sourceH3Map, crosswalk);
      const accuracyMetric = this.calculateAccuracy(crosswalk);

      const result: H3AlignmentResult = {
        crosswalk: crosswalk,
        quality_metrics: {
          coverage: coverageMetric,
          accuracy: accuracyMetric,
          resolution: request.resolution,
        },
      };

      logger.info('H3 alignment completed', {
        crosswalkSize: crosswalk.length,
        coverage: coverageMetric,
        accuracy: accuracyMetric,
      });

      return result;
    } catch (error) {
      logger.error('H3 alignment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        'H3_ALIGNMENT_ERROR',
        'Failed to perform H3 alignment',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Convert GeoJSON geometry to H3 indices
   */
  private featureToH3(geometry: GeoJSONGeometry, resolution: number): string[] {
    try {
      const feature = turf.feature(geometry);
      const bbox = turf.bbox(feature);
      const bboxPolygon = turf.bboxPolygon(bbox);

      // Get all H3 cells that intersect the bounding box
      const h3Indices: Set<string> = new Set();

      // Sample points within the geometry to get H3 cells
      const points = turf.pointGrid(bbox, 0.01, { units: 'kilometers' });

      for (const point of points.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
          const [lng, lat] = point.geometry.coordinates;
          const h3Index = geoToH3(lat, lng, resolution);
          h3Indices.add(h3Index);
        }
      }

      return Array.from(h3Indices);
    } catch (error) {
      logger.error('Feature to H3 conversion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        geometryType: geometry.type,
      });
      return [];
    }
  }

  /**
   * Calculate coverage metric (how much of source is covered)
   */
  private calculateCoverage(
    sourceH3Map: Map<string, Set<string>>,
    crosswalk: Array<{ source_id: string; h3_index: string }>
  ): number {
    const totalSourceH3 = Array.from(sourceH3Map.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );

    const coveredH3 = new Set(crosswalk.map((c) => c.h3_index));

    return coveredH3.size / totalSourceH3;
  }

  /**
   * Calculate accuracy metric (average weight confidence)
   */
  private calculateAccuracy(
    crosswalk: Array<{ weight: number }>
  ): number {
    if (crosswalk.length === 0) return 0;

    const totalWeight = crosswalk.reduce((sum, c) => sum + c.weight, 0);
    return totalWeight / crosswalk.length;
  }

  /**
   * Calculate compactness metrics for a district
   *
   * Calculates multiple compactness measures used in redistricting analysis:
   * - Polsby-Popper: Ratio of area to perimeter (1.0 = perfect circle)
   * - Reock: Ratio of area to minimum bounding circle
   * - Convex Hull Ratio: Ratio of area to convex hull
   *
   * @param geometry - District geometry
   * @returns Compactness metrics
   */
  public async calculateCompactness(
    geometry: GeoJSONGeometry
  ): Promise<CompactnessMetrics> {
    try {
      logger.info('Calculating compactness metrics', {
        geometryType: geometry.type,
      });

      const feature = turf.feature(geometry);

      // Calculate area and perimeter
      const area = turf.area(feature); // square meters
      const perimeter = turf.length(feature, { units: 'meters' });

      // Polsby-Popper = 4π * area / perimeter²
      const polsbyPopper = (4 * Math.PI * area) / Math.pow(perimeter, 2);

      // Reock = area / area of minimum bounding circle
      const circle = turf.circle(turf.center(feature).geometry.coordinates, perimeter / (2 * Math.PI), {
        units: 'meters',
      });
      const circleArea = turf.area(circle);
      const reock = area / circleArea;

      // Convex Hull Ratio = area / area of convex hull
      const convexHull = turf.convex(feature);
      const convexHullArea = convexHull ? turf.area(convexHull) : area;
      const convexHullRatio = area / convexHullArea;

      const metrics: CompactnessMetrics = {
        polsby_popper: Math.min(polsbyPopper, 1.0),
        reock: Math.min(reock, 1.0),
        convex_hull_ratio: Math.min(convexHullRatio, 1.0),
        perimeter: perimeter,
        area: area,
      };

      logger.info('Compactness metrics calculated', {
        polsbyPopper: metrics.polsby_popper.toFixed(4),
        reock: metrics.reock.toFixed(4),
        convexHullRatio: metrics.convex_hull_ratio.toFixed(4),
      });

      return metrics;
    } catch (error) {
      logger.error('Compactness calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        geometryType: geometry.type,
      });

      throw new APIError(
        'COMPACTNESS_CALCULATION_ERROR',
        'Failed to calculate compactness metrics',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Create buffer around geometry
   *
   * Creates a buffer zone around a geometry at a specified radius.
   * Used for proximity analysis and impact assessment.
   *
   * @param request - Buffer parameters
   * @returns Buffered geometry with area
   */
  public async bufferAnalysis(request: BufferRequest): Promise<BufferResponse> {
    try {
      logger.info('Performing buffer analysis', {
        geometryType: request.geometry.type,
        radius: request.radius,
        units: request.units,
      });

      const feature = turf.feature(request.geometry);
      const buffered = turf.buffer(feature, request.radius, {
        units: request.units || 'meters',
      });

      if (!buffered) {
        throw new APIError(
          'BUFFER_ERROR',
          'Failed to create buffer',
          500
        );
      }

      const bufferArea = turf.area(buffered);

      const response: BufferResponse = {
        geometry: buffered.geometry,
        area: bufferArea,
        units: 'square meters',
      };

      logger.info('Buffer analysis completed', {
        bufferArea: bufferArea.toFixed(2),
      });

      return response;
    } catch (error) {
      logger.error('Buffer analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        'BUFFER_ANALYSIS_ERROR',
        'Failed to perform buffer analysis',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Calculate spatial intersection
   *
   * Finds the intersection of two geometries and calculates overlap metrics.
   * Used for analyzing district overlaps and geographic relationships.
   *
   * @param request - Intersection parameters
   * @returns Intersection geometry and overlap percentage
   */
  public async spatialIntersection(
    request: IntersectionRequest
  ): Promise<IntersectionResponse> {
    try {
      logger.info('Calculating spatial intersection', {
        geometry1Type: request.geometry1.type,
        geometry2Type: request.geometry2.type,
      });

      const feature1 = turf.feature(request.geometry1);
      const feature2 = turf.feature(request.geometry2);

      const intersection = turf.intersect(
        turf.featureCollection([feature1, feature2])
      );

      let intersectionArea = 0;
      let intersectionGeometry: GeoJSONGeometry | null = null;

      if (intersection) {
        intersectionArea = turf.area(intersection);
        intersectionGeometry = intersection.geometry;
      }

      const area1 = turf.area(feature1);
      const area2 = turf.area(feature2);

      // Calculate overlap as percentage of smaller area
      const smallerArea = Math.min(area1, area2);
      const overlapPercentage = smallerArea > 0 ? (intersectionArea / smallerArea) * 100 : 0;

      const response: IntersectionResponse = {
        geometry: intersectionGeometry,
        area: intersectionArea,
        overlapPercentage: overlapPercentage,
      };

      logger.info('Spatial intersection completed', {
        intersectionArea: intersectionArea.toFixed(2),
        overlapPercentage: overlapPercentage.toFixed(2),
      });

      return response;
    } catch (error) {
      logger.error('Spatial intersection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new APIError(
        'SPATIAL_INTERSECTION_ERROR',
        'Failed to calculate spatial intersection',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Validate GeoJSON geometry
   */
  public validateGeometry(geometry: GeoJSONGeometry): boolean {
    try {
      const feature = turf.feature(geometry);
      return turf.booleanValid(feature);
    } catch (error) {
      logger.error('Geometry validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        geometryType: geometry.type,
      });
      return false;
    }
  }

  /**
   * Calculate centroid of geometry
   */
  public calculateCentroid(geometry: GeoJSONGeometry): [number, number] {
    try {
      const feature = turf.feature(geometry);
      const centroid = turf.centroid(feature);
      return centroid.geometry.coordinates as [number, number];
    } catch (error) {
      logger.error('Centroid calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new APIError(
        'CENTROID_ERROR',
        'Failed to calculate centroid',
        500
      );
    }
  }
}
