/**
 * Compactness Analysis Page
 *
 * Calculate and display compactness metrics for districts with:
 * - District selector
 * - Three compactness metrics (Polsby-Popper, Reock, Convex Hull)
 * - Visual representation with progress bars
 * - Gingles I analysis verdict
 * - Export to CSV
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store'
import { useGeoAgentIntegration, CompactnessMetrics } from '@/hooks/useGeoAgentIntegration'
import { CompactnessDisplay } from '@/components/democracy-litigation/geographic/CompactnessDisplay'
import { Calculator, Download, Info, ChevronDown, CheckCircle, XCircle } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface DistrictCompactnessResult {
  districtId: string
  districtName: string
  metrics: CompactnessMetrics
  ginglesIVerdict: {
    numerosityMet: boolean
    compactnessMet: boolean
    overallSatisfied: boolean
    reasoning: string
  }
  calculatedAt: string
}

// ============================================================================
// Component
// ============================================================================

export default function CompactnessAnalysisPage() {
  // ---------------------------------------------------------------------------
  // State & Hooks
  // ---------------------------------------------------------------------------

  const searchParams = useSearchParams()
  const caseId = searchParams?.get('caseId') || ''

  const { activeCase, geoData } = useDemocracyLitigationStore()
  const { calculateCompactness } = useGeoAgentIntegration()

  // Selected district
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('')

  // Calculation state
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Results
  const [results, setResults] = useState<DistrictCompactnessResult[]>([])

  // Expanded result details
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Extract districts from geographic data
  // ---------------------------------------------------------------------------

  const districts = useMemo(() => {
    return geoData.filter(
      (g) =>
        g.geoType === 'district' ||
        g.geoType === 'congressional_district' ||
        g.geoType === 'state_legislative_district'
    )
  }, [geoData])

  // Get selected district
  const selectedDistrict = useMemo(() => {
    return districts.find((d) => d.id === selectedDistrictId)
  }, [districts, selectedDistrictId])

  // ---------------------------------------------------------------------------
  // Compactness thresholds (Gingles I standards)
  // ---------------------------------------------------------------------------

  const COMPACTNESS_THRESHOLDS = {
    polsby_popper: 0.15, // Typical VRA threshold
    reock: 0.2,
    convex_hull_ratio: 0.7,
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Calculate compactness for selected district
   */
  const handleCalculate = useCallback(async () => {
    if (!selectedDistrict) {
      setError('Please select a district first')
      return
    }

    setCalculating(true)
    setError(null)

    try {
      const metrics = await calculateCompactness({
        geometry: selectedDistrict.geometry,
        metrics: ['polsby_popper', 'reock', 'convex_hull'],
      })

      // Determine Gingles I verdict
      const polsbyPopperMet = metrics.polsby_popper >= COMPACTNESS_THRESHOLDS.polsby_popper
      const reockMet = metrics.reock >= COMPACTNESS_THRESHOLDS.reock
      const convexHullMet = metrics.convex_hull_ratio >= COMPACTNESS_THRESHOLDS.convex_hull_ratio

      // At least 2 of 3 metrics should meet threshold
      const metricsMetCount = [polsbyPopperMet, reockMet, convexHullMet].filter(Boolean).length
      const compactnessMet = metricsMetCount >= 2

      // Check numerosity (minority population >= 50% for majority-minority district)
      const minorityPercent =
        100 -
        (selectedDistrict.whitePercent || selectedDistrict.whitePopulation / selectedDistrict.totalPopulation * 100 || 0)
      const numerosityMet = minorityPercent >= 50

      const overallSatisfied = numerosityMet && compactnessMet

      const reasoning = overallSatisfied
        ? 'District satisfies Gingles I: sufficient numerosity and compactness.'
        : !numerosityMet
          ? 'District fails Gingles I: minority population is not sufficiently large to constitute a majority.'
          : 'District fails Gingles I: not sufficiently compact under VRA standards.'

      const result: DistrictCompactnessResult = {
        districtId: selectedDistrict.id,
        districtName: selectedDistrict.geoName || selectedDistrict.geoId,
        metrics,
        ginglesIVerdict: {
          numerosityMet,
          compactnessMet,
          overallSatisfied,
          reasoning,
        },
        calculatedAt: new Date().toISOString(),
      }

      // Add to results (or replace if already exists)
      setResults((prev) => {
        const existingIndex = prev.findIndex((r) => r.districtId === result.districtId)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = result
          return updated
        }
        return [...prev, result]
      })

      // Auto-expand new result
      setExpandedResults((prev) => new Set(prev).add(result.districtId))
    } catch (err) {
      console.error('[CompactnessAnalysis] Calculation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to calculate compactness')
    } finally {
      setCalculating(false)
    }
  }, [selectedDistrict, calculateCompactness])

  /**
   * Export results to CSV
   */
  const handleExportCSV = useCallback(() => {
    if (results.length === 0) {
      alert('No results to export')
      return
    }

    const csvRows = [
      // Header
      [
        'District ID',
        'District Name',
        'Polsby-Popper',
        'Reock',
        'Convex Hull Ratio',
        'Numerosity Met',
        'Compactness Met',
        'Gingles I Satisfied',
        'Calculated At',
      ].join(','),
      // Data rows
      ...results.map((r) =>
        [
          r.districtId,
          `"${r.districtName}"`,
          r.metrics.polsby_popper.toFixed(3),
          r.metrics.reock.toFixed(3),
          r.metrics.convex_hull_ratio.toFixed(3),
          r.ginglesIVerdict.numerosityMet ? 'Yes' : 'No',
          r.ginglesIVerdict.compactnessMet ? 'Yes' : 'No',
          r.ginglesIVerdict.overallSatisfied ? 'Yes' : 'No',
          r.calculatedAt,
        ].join(',')
      ),
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compactness-analysis-${caseId}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [results, caseId])

  /**
   * Toggle result expansion
   */
  const toggleResultExpansion = useCallback((districtId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      if (next.has(districtId)) {
        next.delete(districtId)
      } else {
        next.add(districtId)
      }
      return next
    })
  }, [])

  /**
   * Clear all results
   */
  const handleClearResults = useCallback(() => {
    setResults([])
    setExpandedResults(new Set())
    setError(null)
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
      <span className="font-medium text-gray-900 dark:text-white">
        Compactness Analysis
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
            Please select a case to analyze compactness
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
          Compactness Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Calculate district compactness metrics for Gingles I analysis under the Voting Rights
          Act
        </p>
      </div>

      {/* Control panel */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* District selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select District
            </label>
            <div className="relative">
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none"
                disabled={calculating}
              >
                <option value="">Choose a district...</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.geoName || district.geoId}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Calculate button */}
          <div>
            <button
              onClick={handleCalculate}
              disabled={!selectedDistrictId || calculating}
              className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              {calculating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Calculate Compactness
                </>
              )}
            </button>
          </div>

          {/* Export button */}
          <div>
            <button
              onClick={handleExportCSV}
              disabled={results.length === 0}
              className="w-full px-6 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Download className="w-4 h-4" />
              Export to CSV
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">Gingles I Precondition</p>
            <p>
              Under Thornburg v. Gingles (1986), a minority group must demonstrate that it is
              sufficiently large and geographically compact to constitute a majority in a
              single-member district. This tool calculates three standard compactness metrics:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Polsby-Popper:</strong> Measures deviation from a circle (threshold: ≥
                0.15)
              </li>
              <li>
                <strong>Reock:</strong> Ratio of district area to minimum bounding circle
                (threshold: ≥ 0.20)
              </li>
              <li>
                <strong>Convex Hull Ratio:</strong> Detects indentation and fragmentation
                (threshold: ≥ 0.70)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Analysis Results ({results.length})
            </h2>
            <button
              onClick={handleClearResults}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Clear All
            </button>
          </div>

          {results.map((result) => {
            const isExpanded = expandedResults.has(result.districtId)

            return (
              <div
                key={result.districtId}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Result header (collapsible) */}
                <button
                  onClick={() => toggleResultExpansion(result.districtId)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {result.ginglesIVerdict.overallSatisfied ? (
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {result.districtName}
                      </h3>
                      <p
                        className={`text-sm ${
                          result.ginglesIVerdict.overallSatisfied
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {result.ginglesIVerdict.overallSatisfied
                          ? 'Satisfies Gingles I'
                          : 'Does Not Satisfy Gingles I'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Result details (expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6">
                    {/* Compactness metrics */}
                    <CompactnessDisplay
                      metrics={result.metrics}
                      districtName={result.districtName}
                    />

                    {/* Gingles I verdict details */}
                    <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Gingles I Analysis
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Numerosity (≥50% minority)
                          </span>
                          <span
                            className={`font-medium ${
                              result.ginglesIVerdict.numerosityMet
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {result.ginglesIVerdict.numerosityMet ? '✓ Met' : '✗ Not Met'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Compactness (≥2 of 3 metrics)
                          </span>
                          <span
                            className={`font-medium ${
                              result.ginglesIVerdict.compactnessMet
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {result.ginglesIVerdict.compactnessMet ? '✓ Met' : '✗ Not Met'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {result.ginglesIVerdict.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                      Calculated at {new Date(result.calculatedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !calculating && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Analysis Results Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Select a district above and click "Calculate Compactness" to begin analysis
          </p>
        </div>
      )}
    </div>
  )
}
