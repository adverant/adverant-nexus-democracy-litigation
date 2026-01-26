/**
 * GeoAgent Embed Component
 *
 * Embeds the GeoAgent plugin view for VRA geographic analysis.
 * Passes case context via URL parameters and implements bidirectional
 * postMessage communication for seamless integration.
 *
 * CRITICAL: This is an iframe wrapper - NOT a code copy.
 * All geographic functionality comes from the existing GeoAgent plugin.
 *
 * Features:
 * - Authenticated iframe embedding with token passing
 * - postMessage communication (bidirectional)
 * - Loading state with spinner
 * - Error boundaries
 * - Event handlers for district selection, compactness calculation
 * - Supports multiple view modes (explore, timeline, analytics)
 */

'use client'

import { useAuthToken } from '@/stores/dashboard-store'
import { useThemeStore } from '@/stores/theme-store'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

// ============================================================================
// Types
// ============================================================================

/**
 * Compactness metrics for VRA district analysis
 */
export interface CompactnessMetrics {
  /** Polsby-Popper score (0-1, higher = more compact) */
  polsby_popper: number

  /** Reock score (0-1, higher = more compact) */
  reock: number

  /** Convex hull ratio (0-1, higher = more compact) */
  convex_hull_ratio: number

  /** Schwartzberg score (≥1, lower = more compact) */
  schwartzberg?: number

  /** Length-width ratio */
  length_width_ratio?: number
}

/**
 * District selection event payload
 */
export interface DistrictSelectionPayload {
  districtId: string
  districtName?: string
  demographics?: {
    total_population: number
    white_percent: number
    black_percent: number
    hispanic_percent: number
    asian_percent: number
    other_percent: number
  }
  geometry?: GeoJSON.Geometry
}

/**
 * Geographic data passed to GeoAgent
 */
export interface GeoAgentData {
  districts?: Array<{
    id: string
    name: string
    geometry: GeoJSON.Geometry
    demographics?: Record<string, unknown>
  }>
  census?: Array<{
    block_id: string
    geometry: GeoJSON.Geometry
    population: number
    demographics: Record<string, unknown>
  }>
  precincts?: Array<{
    precinct_id: string
    geometry: GeoJSON.Geometry
    election_results?: Record<string, unknown>
  }>
}

/**
 * GeoAgent view modes
 */
export type GeoAgentView = 'explore' | 'timeline' | 'analytics'

/**
 * postMessage event types from GeoAgent
 */
export type GeoAgentEventType =
  | 'GEOAGENT_READY'
  | 'GEOAGENT_DISTRICT_SELECTED'
  | 'GEOAGENT_COMPACTNESS_CALCULATED'
  | 'GEOAGENT_ERROR'
  | 'GEOAGENT_LAYER_TOGGLED'

/**
 * postMessage event types to GeoAgent
 */
export type DemocracyLitigationEventType =
  | 'DL_SET_ACTIVE_DISTRICT'
  | 'DL_HIGHLIGHT_DISTRICTS'
  | 'DL_UPDATE_DATA'
  | 'DL_CALCULATE_COMPACTNESS'

/**
 * Message event from GeoAgent iframe
 */
export interface GeoAgentMessage {
  type: GeoAgentEventType
  payload: unknown
  source: 'geoagent'
}

/**
 * Message event to GeoAgent iframe
 */
export interface DemocracyLitigationMessage {
  type: DemocracyLitigationEventType
  payload: unknown
  source: 'democracy-litigation'
}

// ============================================================================
// Props
// ============================================================================

export interface GeoAgentEmbedProps {
  /** Case ID for context */
  caseId: string

  /** View mode for GeoAgent */
  view?: GeoAgentView

  /** Height of iframe (CSS value) */
  height?: string

  /** Optional geographic data to pass to GeoAgent */
  data?: GeoAgentData

  /** Callback when user selects a district in GeoAgent */
  onDistrictSelect?: (payload: DistrictSelectionPayload) => void

  /** Callback when compactness metrics are calculated */
  onCompactnessCalculated?: (metrics: CompactnessMetrics) => void

  /** Callback when GeoAgent iframe is ready */
  onReady?: () => void

  /** Callback when error occurs in GeoAgent */
  onError?: (error: Error) => void

  /** Additional CSS classes */
  className?: string

  /** Whether to show loading overlay */
  showLoading?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function GeoAgentEmbed({
  caseId,
  view = 'explore',
  height = '100%',
  data,
  onDistrictSelect,
  onCompactnessCalculated,
  onReady,
  onError,
  className = '',
  showLoading = true,
}: GeoAgentEmbedProps) {
  // --------------------------------------------------------------------------
  // Hooks
  // --------------------------------------------------------------------------

  const token = useAuthToken()
  const { theme } = useThemeStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --------------------------------------------------------------------------
  // URL Construction
  // --------------------------------------------------------------------------

  /**
   * Build GeoAgent URL with Democracy Litigation context
   *
   * The URL includes:
   * - Authentication token (for API access)
   * - Tab preset (geo)
   * - View mode (explore, timeline, analytics)
   * - Case ID (for context-specific data)
   * - Plugin context identifier
   * - Widget enablement flags
   * - Theme preference
   */
  const geoAgentUrl = useMemo(() => {
    if (!token) {
      return null
    }

    const params = new URLSearchParams({
      // Authentication
      auth_token: token,

      // GeoAgent view configuration
      tab: 'geo',
      view: view,

      // Democracy Litigation context
      case_id: caseId,
      plugin_context: 'democracy-litigation',

      // Enable VRA-specific widgets
      enable_widgets: 'vra-district,gingles-i,demographic-summary',

      // Theme
      theme: theme,

      // Pass data if provided (encoded as JSON)
      ...(data && { data: JSON.stringify(data) }),
    })

    return `/dashboard/data-explorer?${params.toString()}`
  }, [token, view, caseId, theme, data])

  // --------------------------------------------------------------------------
  // postMessage Communication (Receiving from GeoAgent)
  // --------------------------------------------------------------------------

  /**
   * Handle messages from GeoAgent iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent<GeoAgentMessage>) => {
      // Security: Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return
      }

      // Security: Only accept messages from GeoAgent
      if (event.data?.source !== 'geoagent') {
        return
      }

      const { type, payload } = event.data

      switch (type) {
        case 'GEOAGENT_READY':
          setLoading(false)
          setError(null)
          onReady?.()
          break

        case 'GEOAGENT_DISTRICT_SELECTED':
          if (onDistrictSelect && isDistrictSelectionPayload(payload)) {
            onDistrictSelect(payload)
          }
          break

        case 'GEOAGENT_COMPACTNESS_CALCULATED':
          if (onCompactnessCalculated && isCompactnessMetrics(payload)) {
            onCompactnessCalculated(payload)
          }
          break

        case 'GEOAGENT_ERROR':
          const errorMessage = typeof payload === 'string'
            ? payload
            : 'Unknown error from GeoAgent'
          setError(errorMessage)
          onError?.(new Error(errorMessage))
          break

        case 'GEOAGENT_LAYER_TOGGLED':
          // Handle layer toggle event if needed
          break

        default:
          // Unknown event type - ignore
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onDistrictSelect, onCompactnessCalculated, onReady, onError])

  // --------------------------------------------------------------------------
  // postMessage Communication (Sending to GeoAgent)
  // --------------------------------------------------------------------------

  /**
   * Send message to GeoAgent iframe
   */
  const sendToGeoAgent = useCallback((
    type: DemocracyLitigationEventType,
    payload: unknown
  ) => {
    if (!iframeRef.current?.contentWindow) {
      console.warn('[GeoAgentEmbed] Cannot send message - iframe not ready')
      return
    }

    const message: DemocracyLitigationMessage = {
      type,
      payload,
      source: 'democracy-litigation',
    }

    iframeRef.current.contentWindow.postMessage(
      message,
      window.location.origin
    )
  }, [])

  // Expose sendToGeoAgent method via ref if needed by parent
  useEffect(() => {
    if (iframeRef.current) {
      // Attach helper method to iframe element (for parent access)
      (iframeRef.current as any).sendMessage = sendToGeoAgent
    }
  }, [sendToGeoAgent])

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  /**
   * Handle iframe load errors
   */
  const handleIframeError = useCallback(() => {
    const errorMessage = 'Failed to load GeoAgent'
    setError(errorMessage)
    setLoading(false)
    onError?.(new Error(errorMessage))
  }, [onError])

  /**
   * Handle iframe load success
   */
  const handleIframeLoad = useCallback(() => {
    // Don't set loading=false here - wait for GEOAGENT_READY message
    // This ensures GeoAgent is fully initialized before hiding spinner
  }, [])

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  // No token available
  if (!token) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Authentication required
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Please sign in to view geographic analysis
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 dark:bg-red-900/20 ${className}`}
        style={{ height }}
      >
        <div className="text-center max-w-md">
          <div className="text-red-600 dark:text-red-400 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-600 dark:text-red-400 font-medium">
            {error}
          </p>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              // Force iframe reload
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src
              }
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      {/* Loading Overlay */}
      {loading && showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-10">
          <div className="text-center">
            {/* Spinner */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />

            {/* Loading text */}
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Loading GeoAgent...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Initializing geographic analysis for case {caseId}
            </p>
          </div>
        </div>
      )}

      {/* GeoAgent iframe */}
      {geoAgentUrl && (
        <iframe
          ref={iframeRef}
          src={geoAgentUrl}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          title="GeoAgent Geographic Analysis"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="geolocation; clipboard-read; clipboard-write"
        />
      )}
    </div>
  )
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DistrictSelectionPayload
 */
function isDistrictSelectionPayload(
  payload: unknown
): payload is DistrictSelectionPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'districtId' in payload &&
    typeof (payload as DistrictSelectionPayload).districtId === 'string'
  )
}

/**
 * Type guard for CompactnessMetrics
 */
function isCompactnessMetrics(
  payload: unknown
): payload is CompactnessMetrics {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'polsby_popper' in payload &&
    'reock' in payload &&
    typeof (payload as CompactnessMetrics).polsby_popper === 'number' &&
    typeof (payload as CompactnessMetrics).reock === 'number'
  )
}

// ============================================================================
// Exported Helper Functions
// ============================================================================

/**
 * Helper to send message to GeoAgent iframe from outside component
 *
 * Usage:
 * ```typescript
 * const iframeRef = useRef<HTMLIFrameElement>(null)
 *
 * // Later:
 * sendMessageToGeoAgent(iframeRef, 'DL_SET_ACTIVE_DISTRICT', { districtId: 'TX-01' })
 * ```
 */
export function sendMessageToGeoAgent(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  type: DemocracyLitigationEventType,
  payload: unknown
) {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[GeoAgentEmbed] Cannot send message - iframe not ready')
    return
  }

  const message: DemocracyLitigationMessage = {
    type,
    payload,
    source: 'democracy-litigation',
  }

  iframeRef.current.contentWindow.postMessage(
    message,
    window.location.origin
  )
}

/**
 * Hook to get iframe ref and sendMessage helper
 *
 * Usage:
 * ```typescript
 * const { iframeRef, sendMessage } = useGeoAgentEmbed()
 *
 * <GeoAgentEmbed ref={iframeRef} ... />
 *
 * // Later:
 * sendMessage('DL_SET_ACTIVE_DISTRICT', { districtId: 'TX-01' })
 * ```
 */
export function useGeoAgentEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const sendMessage = useCallback(
    (type: DemocracyLitigationEventType, payload: unknown) => {
      sendMessageToGeoAgent(iframeRef, type, payload)
    },
    []
  )

  return { iframeRef, sendMessage }
}
