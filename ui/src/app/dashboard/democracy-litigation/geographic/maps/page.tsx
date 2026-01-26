/**
 * Geographic Maps Page
 *
 * Full-screen GeoAgent iframe embed with control panel sidebar for:
 * - District selection
 * - Layer toggles (census, precincts, election results)
 * - Compactness metrics display
 *
 * Bidirectional communication with GeoAgent via postMessage.
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  GeoAgentEmbed,
  DistrictSelectionPayload,
  CompactnessMetrics,
} from '@/components/democracy-litigation/geographic/GeoAgentEmbed'
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store'
import { useGeoAgentIntegration } from '@/hooks/useGeoAgentIntegration'
import { ChevronLeft, ChevronRight, Info, Download, RefreshCw } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface LayerState {
  districts: boolean
  census: boolean
  precincts: boolean
  electionResults: boolean
  minorityDensity: boolean
}

interface SelectedDistrictData {
  districtId: string
  districtName: string
  demographics?: {
    total_population: number
    white_percent: number
    black_percent: number
    hispanic_percent: number
    asian_percent: number
    other_percent: number
  }
  compactness?: CompactnessMetrics
}

// ============================================================================
// Component
// ============================================================================

export default function GeographicMapsPage() {
  // ---------------------------------------------------------------------------
  // State & Hooks
  // ---------------------------------------------------------------------------

  const searchParams = useSearchParams()
  const caseId = searchParams?.get('caseId') || ''

  const { activeCase, geoData } = useDemocracyLitigationStore()
  const { calculateCompactness } = useGeoAgentIntegration()

  // Sidebar open/close
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Layer toggles
  const [layers, setLayers] = useState<LayerState>({
    districts: true,
    census: false,
    precincts: false,
    electionResults: false,
    minorityDensity: false,
  })

  // Selected district
  const [selectedDistrict, setSelectedDistrict] = useState<SelectedDistrictData | null>(null)

  // Compactness calculation loading
  const [compactnessLoading, setCompactnessLoading] = useState(false)
  const [compactnessError, setCompactnessError] = useState<string | null>(null)

  // GeoAgent ready state
  const [geoAgentReady, setGeoAgentReady] = useState(false)

  // ---------------------------------------------------------------------------
  // Extract districts from geographic data
  // ---------------------------------------------------------------------------

  const districts = useMemo(() => {
    return geoData.filter((g) => g.geoType === 'district' || g.geoType === 'congressional_district')
  }, [geoData])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle district selection from GeoAgent
   */
  const handleDistrictSelect = useCallback(
    async (payload: DistrictSelectionPayload) => {
      console.log('[GeographicMaps] District selected:', payload)

      setSelectedDistrict({
        districtId: payload.districtId,
        districtName: payload.districtName || payload.districtId,
        demographics: payload.demographics,
        compactness: undefined,
      })

      // Automatically calculate compactness if geometry is available
      if (payload.geometry) {
        setCompactnessLoading(true)
        setCompactnessError(null)

        try {
          const metrics = await calculateCompactness({
            geometry: payload.geometry,
            metrics: ['polsby_popper', 'reock', 'convex_hull'],
          })

          setSelectedDistrict((prev) =>
            prev
              ? {
                  ...prev,
                  compactness: metrics,
                }
              : null
          )
        } catch (error) {
          console.error('[GeographicMaps] Failed to calculate compactness:', error)
          setCompactnessError(
            error instanceof Error ? error.message : 'Failed to calculate compactness'
          )
        } finally {
          setCompactnessLoading(false)
        }
      }
    },
    [calculateCompactness]
  )

  /**
   * Handle compactness calculation from GeoAgent
   */
  const handleCompactnessCalculated = useCallback((metrics: CompactnessMetrics) => {
    console.log('[GeographicMaps] Compactness calculated:', metrics)

    setSelectedDistrict((prev) =>
      prev
        ? {
            ...prev,
            compactness: metrics,
          }
        : null
    )
  }, [])

  /**
   * Handle GeoAgent ready
   */
  const handleGeoAgentReady = useCallback(() => {
    console.log('[GeographicMaps] GeoAgent ready')
    setGeoAgentReady(true)
  }, [])

  /**
   * Handle GeoAgent error
   */
  const handleGeoAgentError = useCallback((error: Error) => {
    console.error('[GeographicMaps] GeoAgent error:', error)
  }, [])

  /**
   * Toggle layer visibility
   */
  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }))
  }, [])

  /**
   * Download map as image
   */
  const handleDownloadMap = useCallback(() => {
    // TODO: Implement map download via GeoAgent postMessage
    console.log('[GeographicMaps] Download map')
  }, [])

  /**
   * Refresh map
   */
  const handleRefreshMap = useCallback(() => {
    setSelectedDistrict(null)
    setCompactnessError(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Breadcrumb
  // ---------------------------------------------------------------------------

  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
      <a
        href="/dashboard/democracy-litigation"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        Democracy Litigation
      </a>
      <span>/</span>
      <a
        href={`/dashboard/democracy-litigation?caseId=${caseId}`}
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {activeCase?.name || 'Case'}
      </a>
      <span>/</span>
      <span className="font-medium text-gray-900 dark:text-white">Geographic Maps</span>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!caseId) {
    return (
      <div className="p-6">
        {breadcrumb}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <p className="text-yellow-800 dark:text-yellow-200 font-medium">
            No case selected
          </p>
          <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">
            Please select a case to view geographic maps
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {breadcrumb}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Geographic Maps
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {activeCase?.name || 'Interactive district mapping and analysis'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={handleRefreshMap}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>

            {/* Download button */}
            <button
              onClick={handleDownloadMap}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* GeoAgent iframe (full width/height) */}
        <div className="flex-1 relative">
          {!geoAgentReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
              </div>
            </div>
          )}

          <GeoAgentEmbed
            caseId={caseId}
            view="explore"
            height="100%"
            onDistrictSelect={handleDistrictSelect}
            onCompactnessCalculated={handleCompactnessCalculated}
            onReady={handleGeoAgentReady}
            onError={handleGeoAgentError}
            showLoading={false}
          />
        </div>

        {/* Control panel sidebar */}
        {sidebarOpen && (
          <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Layer controls */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Map Layers
                </h3>
                <div className="space-y-3">
                  {/* Districts layer */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers.districts}
                      onChange={() => toggleLayer('districts')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Districts
                    </span>
                  </label>

                  {/* Census blocks layer */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers.census}
                      onChange={() => toggleLayer('census')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Census Blocks
                    </span>
                  </label>

                  {/* Precincts layer */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers.precincts}
                      onChange={() => toggleLayer('precincts')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Precincts
                    </span>
                  </label>

                  {/* Election results overlay */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers.electionResults}
                      onChange={() => toggleLayer('electionResults')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Election Results
                    </span>
                  </label>

                  {/* Minority density heatmap */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers.minorityDensity}
                      onChange={() => toggleLayer('minorityDensity')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Minority Population Density
                    </span>
                  </label>
                </div>
              </div>

              {/* District selector */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  District Selection
                </h3>
                {districts.length > 0 ? (
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                    <option value="">Select a district...</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.geoName || district.geoId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No districts loaded. Click a district on the map to select it.
                  </p>
                )}
              </div>

              {/* Selected district info */}
              {selectedDistrict && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
                    {selectedDistrict.districtName}
                  </h4>

                  {/* Demographics */}
                  {selectedDistrict.demographics && (
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700 dark:text-blue-300">
                          Total Population
                        </span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedDistrict.demographics.total_population.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700 dark:text-blue-300">White</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedDistrict.demographics.white_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700 dark:text-blue-300">Black</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedDistrict.demographics.black_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700 dark:text-blue-300">Hispanic</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedDistrict.demographics.hispanic_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700 dark:text-blue-300">Asian</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedDistrict.demographics.asian_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Compactness metrics */}
                  {compactnessLoading && (
                    <div className="text-center py-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Calculating compactness...
                      </p>
                    </div>
                  )}

                  {compactnessError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {compactnessError}
                      </p>
                    </div>
                  )}

                  {selectedDistrict.compactness && !compactnessLoading && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-1">
                        Compactness Metrics
                        <button
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          title="Used for Gingles I analysis"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </h5>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-blue-700 dark:text-blue-300">
                            Polsby-Popper
                          </span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {selectedDistrict.compactness.polsby_popper.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700 dark:text-blue-300">Reock</span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {selectedDistrict.compactness.reock.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700 dark:text-blue-300">
                            Convex Hull
                          </span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {selectedDistrict.compactness.convex_hull_ratio.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info note */}
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex gap-2">
                  <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <p className="font-medium mb-1">Interactive Map Controls</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Click districts to view demographics</li>
                      <li>Toggle layers to show/hide data</li>
                      <li>Compactness is auto-calculated</li>
                      <li>Use mouse wheel to zoom</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
