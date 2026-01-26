/**
 * GeoAgentEmbed - Usage Examples
 *
 * This file demonstrates how to use the GeoAgentEmbed component
 * in various scenarios for Democracy Litigation.
 *
 * DO NOT IMPORT THIS FILE - It's for documentation only.
 */

import React, { useState, useCallback } from 'react'
import { GeoAgentEmbed, useGeoAgentEmbed } from './GeoAgentEmbed'
import type {
  CompactnessMetrics,
  DistrictSelectionPayload,
  GeoAgentData,
} from './GeoAgentEmbed'

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

export function BasicGeographicAnalysis({ caseId }: { caseId: string }) {
  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="explore"
        onReady={() => console.log('GeoAgent loaded')}
      />
    </div>
  )
}

// ============================================================================
// Example 2: With Event Handlers
// ============================================================================

export function InteractiveGeographicAnalysis({ caseId }: { caseId: string }) {
  const handleDistrictSelect = (payload: DistrictSelectionPayload) => {
    console.log('District selected:', payload.districtId)
    console.log('Demographics:', payload.demographics)
  }

  const handleCompactnessCalculated = (metrics: CompactnessMetrics) => {
    console.log('Polsby-Popper:', metrics.polsby_popper)
    console.log('Reock:', metrics.reock)

    // Check Gingles I compactness threshold
    if (metrics.polsby_popper > 0.15) {
      console.log('District likely satisfies Gingles I compactness')
    }
  }

  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="explore"
        onDistrictSelect={handleDistrictSelect}
        onCompactnessCalculated={handleCompactnessCalculated}
        onError={(error) => console.error('GeoAgent error:', error)}
      />
    </div>
  )
}

// ============================================================================
// Example 3: With Pre-loaded Data
// ============================================================================

export function PreloadedDataAnalysis({ caseId }: { caseId: string }) {
  // Pre-loaded geographic data from Democracy Litigation API
  const geoData: GeoAgentData = {
    districts: [
      {
        id: 'TX-01',
        name: 'Texas Congressional District 1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            /* ... */
          ],
        },
        demographics: {
          total_population: 750000,
          white_percent: 45.2,
          black_percent: 35.8,
          hispanic_percent: 15.3,
        },
      },
    ],
    census: [
      /* Census block data */
    ],
    precincts: [
      /* Precinct data */
    ],
  }

  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="analytics"
        data={geoData}
        onReady={() => console.log('GeoAgent loaded with case data')}
      />
    </div>
  )
}

// ============================================================================
// Example 4: Using the Hook for Advanced Control
// ============================================================================

export function AdvancedGeographicControl({ caseId }: { caseId: string }) {
  const { iframeRef, sendMessage } = useGeoAgentEmbed()

  const highlightDistrict = (districtId: string) => {
    sendMessage('DL_SET_ACTIVE_DISTRICT', { districtId })
  }

  const calculateCompactness = (districtId: string) => {
    sendMessage('DL_CALCULATE_COMPACTNESS', {
      districtId,
      metrics: ['polsby_popper', 'reock', 'convex_hull_ratio'],
    })
  }

  const updateDistrictData = (districts: GeoAgentData['districts']) => {
    sendMessage('DL_UPDATE_DATA', { districts })
  }

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Control Panel */}
      <div className="bg-gray-100 dark:bg-gray-800 p-4 flex gap-2">
        <button
          onClick={() => highlightDistrict('TX-01')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Highlight District TX-01
        </button>
        <button
          onClick={() => calculateCompactness('TX-01')}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Calculate Compactness
        </button>
        <button
          onClick={() => updateDistrictData([/* new data */])}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Update Data
        </button>
      </div>

      {/* GeoAgent Embed */}
      <div className="flex-1">
        <GeoAgentEmbed
          caseId={caseId}
          view="explore"
          height="100%"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 5: Timeline View for Historical Analysis
// ============================================================================

export function HistoricalRedistrictingAnalysis({
  caseId,
}: {
  caseId: string
}) {
  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="timeline"
        onReady={() => console.log('Timeline view ready')}
      />
    </div>
  )
}

// ============================================================================
// Example 6: Full Page with Multiple Views
// ============================================================================

export function ComprehensiveGeographicDashboard({
  caseId,
}: {
  caseId: string
}) {
  const [activeView, setActiveView] = React.useState<
    'explore' | 'timeline' | 'analytics'
  >('explore')

  return (
    <div className="h-screen w-full flex flex-col">
      {/* View Selector */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('explore')}
            className={`px-4 py-2 rounded ${
              activeView === 'explore'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Explore Map
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`px-4 py-2 rounded ${
              activeView === 'timeline'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded ${
              activeView === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* GeoAgent Embed */}
      <div className="flex-1">
        <GeoAgentEmbed
          caseId={caseId}
          view={activeView}
          showLoading={true}
          onDistrictSelect={(payload) => {
            console.log('District selected:', payload)
            // Update side panel with district details
          }}
          onCompactnessCalculated={(metrics) => {
            console.log('Compactness:', metrics)
            // Display metrics in side panel
          }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 7: Error Handling
// ============================================================================

export function RobustGeographicAnalysis({ caseId }: { caseId: string }) {
  const [error, setError] = React.useState<string | null>(null)

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="explore"
        onError={(err) => setError(err.message)}
        onReady={() => setError(null)}
      />
    </div>
  )
}

// ============================================================================
// Example 8: Integration with Democracy Litigation Store
// ============================================================================

export function StoreIntegratedGeographic({ caseId }: { caseId: string }) {
  // In real implementation, use useDemocracyLitigationStore
  const activeDistrict = null // store.activeDistrict
  const compactnessMetrics = null // store.compactnessMetrics

  const handleDistrictSelect = (payload: DistrictSelectionPayload) => {
    // store.setActiveDistrict(payload.districtId)
    // store.setDistrictDemographics(payload.demographics)
  }

  const handleCompactnessCalculated = (metrics: CompactnessMetrics) => {
    // store.setCompactnessMetrics(metrics)
    // store.evaluateGinglesI(metrics)
  }

  return (
    <div className="h-screen w-full">
      <GeoAgentEmbed
        caseId={caseId}
        view="explore"
        onDistrictSelect={handleDistrictSelect}
        onCompactnessCalculated={handleCompactnessCalculated}
      />
    </div>
  )
}
