/**
 * Compactness Display Component
 *
 * Displays compactness metrics with visual progress bars and interpretations:
 * - Three metric cards (Polsby-Popper, Reock, Convex Hull)
 * - Color-coded progress bars (green/yellow/red)
 * - Interpretation text for each metric
 * - Overall compactness grade (A-F)
 * - Gingles I verdict badge
 */

'use client'

import { useMemo } from 'react'
import { Info, CheckCircle, XCircle } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export interface CompactnessMetrics {
  polsby_popper: number
  reock: number
  convex_hull_ratio: number
  metadata?: {
    area_square_meters?: number
    perimeter_meters?: number
    min_bounding_circle_radius_meters?: number
    convex_hull_area_square_meters?: number
  }
}

export interface CompactnessDisplayProps {
  metrics: CompactnessMetrics
  districtName?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color class for metric score
 */
function getColorClass(score: number, thresholds: { green: number; yellow: number }): {
  bg: string
  text: string
  bar: string
} {
  if (score >= thresholds.green) {
    return {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      bar: 'bg-green-500',
    }
  } else if (score >= thresholds.yellow) {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      bar: 'bg-yellow-500',
    }
  } else {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      bar: 'bg-red-500',
    }
  }
}

/**
 * Get interpretation text for metric
 */
function getInterpretation(
  metric: 'polsby_popper' | 'reock' | 'convex_hull',
  score: number
): string {
  switch (metric) {
    case 'polsby_popper':
      if (score >= 0.5) return 'Highly compact (near circular)'
      if (score >= 0.3) return 'Moderately compact'
      if (score >= 0.15) return 'Meets VRA threshold'
      return 'Not compact'

    case 'reock':
      if (score >= 0.5) return 'Highly compact'
      if (score >= 0.3) return 'Moderately compact'
      if (score >= 0.2) return 'Meets VRA threshold'
      return 'Not compact'

    case 'convex_hull':
      if (score >= 0.9) return 'Highly compact (minimal indentation)'
      if (score >= 0.7) return 'Moderately compact'
      if (score >= 0.5) return 'Some fragmentation'
      return 'Significant fragmentation'
  }
}

/**
 * Get overall grade based on all metrics
 */
function getOverallGrade(metrics: CompactnessMetrics): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label: string
  color: string
} {
  const avgScore =
    (metrics.polsby_popper + metrics.reock + metrics.convex_hull_ratio) / 3

  if (avgScore >= 0.7) {
    return { grade: 'A', label: 'Excellent Compactness', color: 'text-green-600 dark:text-green-400' }
  } else if (avgScore >= 0.5) {
    return { grade: 'B', label: 'Good Compactness', color: 'text-blue-600 dark:text-blue-400' }
  } else if (avgScore >= 0.3) {
    return { grade: 'C', label: 'Fair Compactness', color: 'text-yellow-600 dark:text-yellow-400' }
  } else if (avgScore >= 0.15) {
    return { grade: 'D', label: 'Marginal Compactness', color: 'text-orange-600 dark:text-orange-400' }
  } else {
    return { grade: 'F', label: 'Poor Compactness', color: 'text-red-600 dark:text-red-400' }
  }
}

/**
 * Determine if Gingles I compactness is satisfied
 */
function ginglesICompactnessSatisfied(metrics: CompactnessMetrics): boolean {
  // VRA thresholds
  const polsbyPopperMet = metrics.polsby_popper >= 0.15
  const reockMet = metrics.reock >= 0.2
  const convexHullMet = metrics.convex_hull_ratio >= 0.7

  // At least 2 of 3 metrics should meet threshold
  const metricsMetCount = [polsbyPopperMet, reockMet, convexHullMet].filter(Boolean).length
  return metricsMetCount >= 2
}

// ============================================================================
// Component
// ============================================================================

export function CompactnessDisplay({ metrics, districtName }: CompactnessDisplayProps) {
  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const overallGrade = useMemo(() => getOverallGrade(metrics), [metrics])
  const ginglesISatisfied = useMemo(() => ginglesICompactnessSatisfied(metrics), [metrics])

  // Metric configurations
  const metricConfigs = useMemo(
    () => [
      {
        key: 'polsby_popper' as const,
        name: 'Polsby-Popper',
        value: metrics.polsby_popper,
        thresholds: { green: 0.5, yellow: 0.3 },
        vraThreshold: 0.15,
        description: 'Measures deviation from a perfect circle. Formula: 4π × Area / Perimeter²',
      },
      {
        key: 'reock' as const,
        name: 'Reock',
        value: metrics.reock,
        thresholds: { green: 0.5, yellow: 0.3 },
        vraThreshold: 0.2,
        description: 'Ratio of district area to minimum bounding circle area',
      },
      {
        key: 'convex_hull' as const,
        name: 'Convex Hull Ratio',
        value: metrics.convex_hull_ratio,
        thresholds: { green: 0.9, yellow: 0.7 },
        vraThreshold: 0.7,
        description: 'Ratio of district area to convex hull area. Detects indentation',
      },
    ],
    [metrics]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      {districtName && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {districtName}
          </h3>
          <div className="flex items-center gap-2">
            {/* Overall grade */}
            <div className="text-center">
              <div
                className={`text-3xl font-bold ${overallGrade.color}`}
              >
                {overallGrade.grade}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {overallGrade.label}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricConfigs.map((config) => {
          const colors = getColorClass(config.value, config.thresholds)
          const interpretation = getInterpretation(config.key, config.value)
          const meetsVRAThreshold = config.value >= config.vraThreshold

          return (
            <div
              key={config.key}
              className={`${colors.bg} border ${colors.bg.replace('bg-', 'border-').replace('/20', '')} rounded-lg p-4`}
            >
              {/* Metric name with info icon */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {config.name}
                </h4>
                <button
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  title={config.description}
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              {/* Score */}
              <div className="mb-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {config.value.toFixed(3)}
                </div>
                <div className={`text-xs ${colors.text}`}>
                  {interpretation}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(config.value * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0.0</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* VRA threshold indicator */}
              <div className="flex items-center gap-1.5 text-xs">
                {meetsVRAThreshold ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300">
                      Meets VRA threshold (≥{config.vraThreshold})
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-300">
                      Below VRA threshold (&lt;{config.vraThreshold})
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Gingles I verdict */}
      <div
        className={`rounded-lg p-4 border-2 ${
          ginglesISatisfied
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-400'
        }`}
      >
        <div className="flex items-center gap-3">
          {ginglesISatisfied ? (
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <div>
            <h4
              className={`text-base font-semibold ${
                ginglesISatisfied
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}
            >
              Gingles I Compactness:{' '}
              {ginglesISatisfied ? 'SATISFIED' : 'NOT SATISFIED'}
            </h4>
            <p
              className={`text-sm mt-1 ${
                ginglesISatisfied
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {ginglesISatisfied
                ? 'District meets compactness requirements under Thornburg v. Gingles (at least 2 of 3 metrics exceed VRA thresholds).'
                : 'District does not meet compactness requirements. Under VRA standards, at least 2 of 3 metrics must exceed minimum thresholds.'}
            </p>
          </div>
        </div>
      </div>

      {/* Metadata (if available) */}
      {metrics.metadata && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Geometric Details
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {metrics.metadata.area_square_meters && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Area:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {(metrics.metadata.area_square_meters / 1_000_000).toFixed(2)} km²
                </span>
              </div>
            )}
            {metrics.metadata.perimeter_meters && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Perimeter:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {(metrics.metadata.perimeter_meters / 1000).toFixed(2)} km
                </span>
              </div>
            )}
            {metrics.metadata.min_bounding_circle_radius_meters && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">MBC Radius:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {(metrics.metadata.min_bounding_circle_radius_meters / 1000).toFixed(2)} km
                </span>
              </div>
            )}
            {metrics.metadata.convex_hull_area_square_meters && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Convex Hull Area:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {(metrics.metadata.convex_hull_area_square_meters / 1_000_000).toFixed(2)} km²
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
