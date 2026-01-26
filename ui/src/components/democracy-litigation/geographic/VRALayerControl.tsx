/**
 * VRA Layer Control Component
 *
 * Layer toggle controls for GeoAgent map with:
 * - Checkboxes for each layer (districts, census, precincts, etc.)
 * - Opacity sliders for each active layer
 * - Layer ordering (drag to reorder z-index)
 * - Sends layer changes to GeoAgent via postMessage
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Layers, Eye, EyeOff, GripVertical } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type LayerType =
  | 'districts'
  | 'census_blocks'
  | 'precincts'
  | 'minority_density'
  | 'election_results'
  | 'polling_locations'
  | 'early_voting_sites'

export interface Layer {
  id: LayerType
  name: string
  description: string
  visible: boolean
  opacity: number
  zIndex: number
}

export interface VRALayerControlProps {
  /** Active layers state */
  activeLayers: LayerType[]

  /** Callback when layer is toggled on/off */
  onLayerToggle: (layerId: LayerType, visible: boolean) => void

  /** Callback when layer opacity changes */
  onOpacityChange: (layerId: LayerType, opacity: number) => void

  /** Callback when layer order changes */
  onLayerReorder?: (layers: LayerType[]) => void

  /** Optional: compact mode (smaller UI) */
  compact?: boolean
}

// ============================================================================
// Default Layers Configuration
// ============================================================================

const DEFAULT_LAYERS: Layer[] = [
  {
    id: 'districts',
    name: 'Districts',
    description: 'Congressional and state legislative districts',
    visible: true,
    opacity: 1.0,
    zIndex: 100,
  },
  {
    id: 'census_blocks',
    name: 'Census Blocks',
    description: 'US Census Bureau block boundaries',
    visible: false,
    opacity: 0.7,
    zIndex: 90,
  },
  {
    id: 'precincts',
    name: 'Precincts',
    description: 'Voting precinct boundaries',
    visible: false,
    opacity: 0.8,
    zIndex: 95,
  },
  {
    id: 'minority_density',
    name: 'Minority Population Density',
    description: 'Heatmap of minority population concentration',
    visible: false,
    opacity: 0.6,
    zIndex: 85,
  },
  {
    id: 'election_results',
    name: 'Election Results',
    description: 'Color-coded by election outcomes',
    visible: false,
    opacity: 0.7,
    zIndex: 80,
  },
  {
    id: 'polling_locations',
    name: 'Polling Locations',
    description: 'Election day polling places',
    visible: false,
    opacity: 1.0,
    zIndex: 110,
  },
  {
    id: 'early_voting_sites',
    name: 'Early Voting Sites',
    description: 'Early voting centers',
    visible: false,
    opacity: 1.0,
    zIndex: 105,
  },
]

// ============================================================================
// Component
// ============================================================================

export function VRALayerControl({
  activeLayers,
  onLayerToggle,
  onOpacityChange,
  onLayerReorder,
  compact = false,
}: VRALayerControlProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Layer state (sync with props)
  const [layers, setLayers] = useState<Layer[]>(() =>
    DEFAULT_LAYERS.map((layer) => ({
      ...layer,
      visible: activeLayers.includes(layer.id),
    }))
  )

  // Dragging state
  const [draggedLayer, setDraggedLayer] = useState<LayerType | null>(null)
  const [dragOverLayer, setDragOverLayer] = useState<LayerType | null>(null)

  // ---------------------------------------------------------------------------
  // Sync layer visibility with activeLayers prop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        visible: activeLayers.includes(layer.id),
      }))
    )
  }, [activeLayers])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Toggle layer visibility
   */
  const handleToggle = useCallback(
    (layerId: LayerType) => {
      const layer = layers.find((l) => l.id === layerId)
      if (!layer) return

      const newVisible = !layer.visible
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, visible: newVisible } : l))
      )

      onLayerToggle(layerId, newVisible)
    },
    [layers, onLayerToggle]
  )

  /**
   * Change layer opacity
   */
  const handleOpacityChange = useCallback(
    (layerId: LayerType, opacity: number) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
      )

      onOpacityChange(layerId, opacity)
    },
    [onOpacityChange]
  )

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((layerId: LayerType) => {
    setDraggedLayer(layerId)
  }, [])

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent, layerId: LayerType) => {
    e.preventDefault()
    setDragOverLayer(layerId)
  }, [])

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    (targetLayerId: LayerType) => {
      if (!draggedLayer || draggedLayer === targetLayerId) {
        setDraggedLayer(null)
        setDragOverLayer(null)
        return
      }

      // Reorder layers
      setLayers((prev) => {
        const draggedIndex = prev.findIndex((l) => l.id === draggedLayer)
        const targetIndex = prev.findIndex((l) => l.id === targetLayerId)

        if (draggedIndex === -1 || targetIndex === -1) return prev

        const newLayers = [...prev]
        const [removed] = newLayers.splice(draggedIndex, 1)
        newLayers.splice(targetIndex, 0, removed)

        // Update z-index
        const reordered = newLayers.map((layer, index) => ({
          ...layer,
          zIndex: 110 - index * 5, // Higher index = higher z-index
        }))

        // Notify parent
        if (onLayerReorder) {
          onLayerReorder(reordered.map((l) => l.id))
        }

        return reordered
      })

      setDraggedLayer(null)
      setDragOverLayer(null)
    },
    [draggedLayer, onLayerReorder]
  )

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setDraggedLayer(null)
    setDragOverLayer(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3
          className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}
        >
          Map Layers
        </h3>
      </div>

      {/* Layer list */}
      <div className="space-y-2">
        {layers.map((layer) => {
          const isDragging = draggedLayer === layer.id
          const isDragOver = dragOverLayer === layer.id

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDrop={() => handleDrop(layer.id)}
              onDragEnd={handleDragEnd}
              className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 transition-all ${
                isDragging ? 'opacity-50' : ''
              } ${isDragOver ? 'border-blue-500 dark:border-blue-400' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing mt-0.5"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>

                {/* Checkbox */}
                <div className="flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => handleToggle(layer.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Layer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <label
                      className={`${compact ? 'text-sm' : 'text-base'} font-medium text-gray-900 dark:text-white cursor-pointer select-none`}
                      onClick={() => handleToggle(layer.id)}
                    >
                      {layer.name}
                    </label>
                    {layer.visible ? (
                      <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {layer.description}
                  </p>

                  {/* Opacity slider (only when visible) */}
                  {layer.visible && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400 w-16">
                          Opacity:
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={layer.opacity}
                          onChange={(e) =>
                            handleOpacityChange(layer.id, parseFloat(e.target.value))
                          }
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
        <p className="font-medium mb-1">Layer Controls</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Check/uncheck to show/hide layers</li>
          <li>Drag to reorder (top = front)</li>
          <li>Adjust opacity with slider</li>
        </ul>
      </div>
    </div>
  )
}
