/**
 * Demographics Overlay Page
 *
 * Upload census data, align with precincts using H3, and visualize demographic overlays:
 * - Census data upload (Shapefile, GeoJSON, CSV)
 * - H3 alignment configuration
 * - Crosswalk table display
 * - Quality metrics
 * - Mini GeoAgent visualization
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store'
import { useGeoAgentIntegration, H3AlignmentResult } from '@/hooks/useGeoAgentIntegration'
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation'
import { GeoAgentEmbed } from '@/components/democracy-litigation/geographic/GeoAgentEmbed'
import {
  Upload,
  Download,
  Play,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface UploadedFile {
  file: File
  type: 'shapefile' | 'geojson' | 'csv'
  data?: GeoJSON.FeatureCollection
  columnMapping?: Record<string, string>
}

interface AlignmentJob {
  jobId: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  message: string
  result?: H3AlignmentResult
}

// ============================================================================
// Component
// ============================================================================

export default function DemographicsOverlayPage() {
  // ---------------------------------------------------------------------------
  // State & Hooks
  // ---------------------------------------------------------------------------

  const searchParams = useSearchParams()
  const caseId = searchParams?.get('caseId') || ''

  const { activeCase, geoData } = useDemocracyLitigationStore()
  const { alignH3 } = useGeoAgentIntegration()
  const { uploadDocument } = useDemocracyLitigation()

  // Census data upload
  const [censusFile, setCensusFile] = useState<UploadedFile | null>(null)
  const [censusUploading, setCensusUploading] = useState(false)
  const [censusError, setCensusError] = useState<string | null>(null)

  // H3 alignment settings
  const [sourceDataType, setSourceDataType] = useState<string>('census_block')
  const [targetDataType, setTargetDataType] = useState<string>('precinct')
  const [h3Resolution, setH3Resolution] = useState<number>(9)

  // Alignment job
  const [alignmentJob, setAlignmentJob] = useState<AlignmentJob | null>(null)

  // Crosswalk table pagination
  const [crosswalkPage, setCrosswalkPage] = useState(0)
  const crosswalkPageSize = 10

  // ---------------------------------------------------------------------------
  // Extract source/target data from geographic data
  // ---------------------------------------------------------------------------

  const sourceData = useMemo(() => {
    return geoData.filter((g) => g.geoType === sourceDataType)
  }, [geoData, sourceDataType])

  const targetData = useMemo(() => {
    return geoData.filter((g) => g.geoType === targetDataType)
  }, [geoData, targetDataType])

  // Convert to GeoJSON FeatureCollection
  const sourceGeoJSON: GeoJSON.FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: sourceData.map((g) => ({
        type: 'Feature',
        id: g.id,
        geometry: g.geometry,
        properties: {
          id: g.geoId,
          name: g.geoName,
          totalPopulation: g.totalPopulation,
          whitePercent: g.whitePercent,
          blackPercent: g.blackPercent,
          hispanicPercent: g.hispanicPercent,
          asianPercent: g.asianPercent,
        },
      })),
    }),
    [sourceData]
  )

  const targetGeoJSON: GeoJSON.FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: targetData.map((g) => ({
        type: 'Feature',
        id: g.id,
        geometry: g.geometry,
        properties: {
          id: g.geoId,
          name: g.geoName,
        },
      })),
    }),
    [targetData]
  )

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle census file upload
   */
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setCensusUploading(true)
      setCensusError(null)

      try {
        // Determine file type
        const extension = file.name.split('.').pop()?.toLowerCase()
        let fileType: 'shapefile' | 'geojson' | 'csv' = 'csv'

        if (extension === 'shp' || extension === 'zip') {
          fileType = 'shapefile'
        } else if (extension === 'geojson' || extension === 'json') {
          fileType = 'geojson'
        } else if (extension === 'csv') {
          fileType = 'csv'
        } else {
          throw new Error('Unsupported file type. Please upload .shp, .geojson, or .csv')
        }

        // Upload to backend
        const result = await uploadDocument(caseId, file, {
          docType: 'census_data',
          tags: ['census', 'demographics', 'h3-alignment'],
        })

        console.log('[DemographicsOverlay] File uploaded:', result)

        // For GeoJSON, parse immediately
        if (fileType === 'geojson') {
          const text = await file.text()
          const data = JSON.parse(text) as GeoJSON.FeatureCollection
          setCensusFile({ file, type: fileType, data })
        } else {
          setCensusFile({ file, type: fileType })
        }
      } catch (error) {
        console.error('[DemographicsOverlay] Upload failed:', error)
        setCensusError(error instanceof Error ? error.message : 'Upload failed')
      } finally {
        setCensusUploading(false)
      }
    },
    [caseId, uploadDocument]
  )

  /**
   * Run H3 alignment
   */
  const handleRunAlignment = useCallback(async () => {
    if (sourceGeoJSON.features.length === 0) {
      alert('No source data available. Please load census data first.')
      return
    }

    if (targetGeoJSON.features.length === 0) {
      alert('No target data available. Please load precinct data first.')
      return
    }

    setAlignmentJob({
      jobId: `job_${Date.now()}`,
      status: 'running',
      progress: 0,
      message: 'Starting H3 alignment...',
    })

    try {
      const result = await alignH3({
        source: sourceGeoJSON,
        target: targetGeoJSON,
        resolution: h3Resolution,
        source_id_property: 'id',
        target_id_property: 'id',
      })

      setAlignmentJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              progress: 100,
              message: 'Alignment complete',
              result,
            }
          : null
      )
    } catch (error) {
      console.error('[DemographicsOverlay] Alignment failed:', error)
      setAlignmentJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              progress: 0,
              message: error instanceof Error ? error.message : 'Alignment failed',
            }
          : null
      )
    }
  }, [sourceGeoJSON, targetGeoJSON, h3Resolution, alignH3])

  /**
   * Export crosswalk to CSV
   */
  const handleExportCrosswalk = useCallback(() => {
    if (!alignmentJob?.result) {
      alert('No crosswalk data to export')
      return
    }

    const csvRows = [
      // Header
      ['Source ID', 'Target ID', 'H3 Cell ID', 'Population Weight'].join(','),
      // Data rows
      ...alignmentJob.result.crosswalk.map((row) =>
        [
          row.census_block_id,
          row.precinct_id,
          row.h3_cell_id || '',
          row.population_weight.toFixed(4),
        ].join(',')
      ),
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `h3-crosswalk-${caseId}-res${h3Resolution}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [alignmentJob, caseId, h3Resolution])

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const crosswalkData = alignmentJob?.result?.crosswalk || []
  const totalPages = Math.ceil(crosswalkData.length / crosswalkPageSize)
  const paginatedCrosswalk = crosswalkData.slice(
    crosswalkPage * crosswalkPageSize,
    (crosswalkPage + 1) * crosswalkPageSize
  )

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
      <span className="font-medium text-gray-900 dark:text-white">
        Demographics Overlay
      </span>
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
            Please select a case to work with demographics overlay
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {breadcrumb}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Demographics Overlay
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload census data and align with precinct boundaries using H3 spatial indexing
        </p>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">H3 Spatial Alignment</p>
            <p>
              Census block boundaries rarely align perfectly with precinct boundaries. This tool
              uses Uber's H3 hexagonal spatial index to create a crosswalk table that
              proportionally allocates demographic data from census blocks to precincts based on
              geographic overlap.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left column: Upload & Config */}
        <div className="space-y-6">
          {/* Census data upload */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Census Data Upload
            </h2>

            <div className="space-y-4">
              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload File
                </label>
                <input
                  type="file"
                  accept=".shp,.zip,.geojson,.json,.csv"
                  onChange={handleFileUpload}
                  disabled={censusUploading}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supported: Shapefile (.shp, .zip), GeoJSON (.geojson), CSV (.csv)
                </p>
              </div>

              {/* Upload status */}
              {censusUploading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Uploading...
                </div>
              )}

              {censusError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-200 text-sm">{censusError}</p>
                </div>
              )}

              {censusFile && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      {censusFile.file.name}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {censusFile.type.toUpperCase()} •{' '}
                      {(censusFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* H3 Alignment Configuration */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              H3 Alignment Configuration
            </h2>

            <div className="space-y-4">
              {/* Source data selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Data (Census)
                </label>
                <select
                  value={sourceDataType}
                  onChange={(e) => setSourceDataType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="census_block">Census Blocks</option>
                  <option value="voting_tabulation_district">Voting Tabulation Districts</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {sourceData.length} features loaded
                </p>
              </div>

              {/* Target data selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Data (Precincts)
                </label>
                <select
                  value={targetDataType}
                  onChange={(e) => setTargetDataType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="precinct">Precincts</option>
                  <option value="district">Districts</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {targetData.length} features loaded
                </p>
              </div>

              {/* H3 resolution slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  H3 Resolution: {h3Resolution}
                </label>
                <input
                  type="range"
                  min="6"
                  max="12"
                  step="1"
                  value={h3Resolution}
                  onChange={(e) => setH3Resolution(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>6 (Coarse)</span>
                  <span>9 (Recommended)</span>
                  <span>12 (Fine)</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Resolution 9 ≈ 0.10 km² per hexagon
                </p>
              </div>

              {/* Run alignment button */}
              <button
                onClick={handleRunAlignment}
                disabled={
                  sourceData.length === 0 ||
                  targetData.length === 0 ||
                  alignmentJob?.status === 'running'
                }
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
              >
                {alignmentJob?.status === 'running' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Running Alignment...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Alignment
                  </>
                )}
              </button>

              {/* Alignment status */}
              {alignmentJob && (
                <div
                  className={`rounded-lg p-3 ${
                    alignmentJob.status === 'completed'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : alignmentJob.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {alignmentJob.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : alignmentJob.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        alignmentJob.status === 'completed'
                          ? 'text-green-800 dark:text-green-200'
                          : alignmentJob.status === 'failed'
                            ? 'text-red-800 dark:text-red-200'
                            : 'text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {alignmentJob.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Visualization */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Alignment Visualization
            </h2>
          </div>
          <div className="h-[600px]">
            <GeoAgentEmbed
              caseId={caseId}
              view="analytics"
              height="100%"
              showLoading={true}
            />
          </div>
        </div>
      </div>

      {/* Crosswalk table and quality metrics */}
      {alignmentJob?.result && (
        <>
          {/* Quality metrics */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quality Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Coverage</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alignmentJob.result.quality_metrics.coverage.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alignmentJob.result.quality_metrics.accuracy.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Source Features</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alignmentJob.result.quality_metrics.total_source_features || sourceData.length}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Target Features</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alignmentJob.result.quality_metrics.total_target_features || targetData.length}
                </p>
              </div>
            </div>
          </div>

          {/* Crosswalk table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Crosswalk Table ({crosswalkData.length} rows)
              </h2>
              <button
                onClick={handleExportCrosswalk}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Target ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      H3 Index
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Weight
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedCrosswalk.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {row.census_block_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {row.precinct_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {row.h3_cell_id || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {row.population_weight.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page {crosswalkPage + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCrosswalkPage((p) => Math.max(0, p - 1))}
                    disabled={crosswalkPage === 0}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCrosswalkPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={crosswalkPage === totalPages - 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
