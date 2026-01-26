/**
 * useDemocracyLitigation Hook
 *
 * Central hook for Democracy Litigation functionality that combines:
 * - DemocracyLitigationClient API client for backend calls
 * - useDemocracySocket for real-time WebSocket updates
 * - useDemocracyStore for state management
 * - Authentication from dashboard store
 *
 * Provides a unified interface for all Democracy Litigation operations with:
 * - Automatic loading/error state management
 * - Real-time progress updates via WebSocket
 * - Caching and optimistic updates
 * - Job polling for async operations
 *
 * @module hooks/useDemocracyLitigation
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthToken } from '@/stores/dashboard-store'
import {
  DemocracyLitigationClient,
  createDemocracyLitigationClient,
  DemocracyLitigationError,
} from '@/lib/api/democracy-litigation'
import type {
  DLCase,
  DLDocument,
  Precedent,
  GeographicData,
  ExpertWitness,
  Deadline,
  Job,
  CreateCaseRequest,
  UpdateCaseRequest,
  ListCasesRequest,
  ListDocumentsRequest,
  TriageDocumentsRequest,
  TriageResults,
  VRASearchRequest,
  CircuitComparisonRequest,
  CircuitComparisonResults,
  LegislativeHistoryRequest,
  LegislativeHistoryTimeline,
  CensusAlignmentRequest,
  CompactnessRequest,
  GeoExportRequest,
  GinglesAnalysis,
  ListExpertsRequest,
  GenerateExpertReportRequest,
  CreateDeadlineRequest,
  UpdateDeadlineRequest,
  ListDeadlinesRequest,
  DeadlineConflict,
  PatternAnalysisResults,
  OpposingCounselIntelligence,
  CaseType,
  CaseStatus,
  CasePhase,
  DocumentType,
  ProcessingStatus,
  GinglesIssue,
  SenateFactor,
  ExpertSpecialty,
  DeadlineType,
  DeadlinePriority,
  JobType,
} from '@/types/democracy-litigation'

// ============================================================================
// Types
// ============================================================================

export interface ProgressState {
  percent: number
  step: string
  message: string
  estimatedTimeRemaining?: number
}

export interface UseDemocracyLitigationOptions {
  /** Auto-fetch cases on mount */
  autoFetchCases?: boolean
  /** Auto-fetch experts on mount */
  autoFetchExperts?: boolean
  /** Auto-connect WebSocket */
  autoConnectSocket?: boolean
  /** Case ID to subscribe for real-time updates */
  caseId?: string
}

export interface UseDemocracyLitigationReturn {
  // API Client
  client: DemocracyLitigationClient | null

  // Connection State
  isConnected: boolean
  socketStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  socketError: Error | null

  // Cases
  cases: DLCase[]
  casesLoading: boolean
  casesError: string | null
  activeCase: DLCase | null
  fetchCases: (params?: ListCasesRequest) => Promise<void>
  createCase: (data: CreateCaseRequest) => Promise<DLCase>
  updateCase: (caseId: string, data: UpdateCaseRequest) => Promise<DLCase>
  deleteCase: (caseId: string) => Promise<void>
  selectCase: (caseId: string | null) => Promise<void>
  getCaseStats: (caseId: string) => Promise<{
    documentCount: number
    researchItems: number
    expertReports: number
    upcomingDeadlines: number
    completionPercent: number
  }>

  // Documents
  documents: DLDocument[]
  documentsLoading: boolean
  documentsError: string | null
  fetchDocuments: (params?: ListDocumentsRequest) => Promise<void>
  uploadDocument: (caseId: string, file: File, metadata?: {
    docType?: DocumentType
    docSubtype?: string
    tags?: string[]
  }) => Promise<{ documentId: string; filename: string; status: string }>
  uploadProgress: ProgressState
  updateDocument: (documentId: string, data: {
    docType?: DocumentType
    docSubtype?: string
    tags?: string[]
    relevanceScore?: number
  }) => Promise<DLDocument>
  deleteDocument: (documentId: string) => Promise<void>
  downloadDocument: (documentId: string) => Promise<Blob>

  // Discovery Triage
  triageDocuments: (caseId: string, documentIds: string[], settings?: {
    relevanceThreshold?: number
    privilegeThreshold?: number
    useMLModel?: boolean
  }) => Promise<string>
  triageResults: TriageResults | null
  triageRunning: boolean
  triageProgress: ProgressState

  // VRA Research
  precedents: Precedent[]
  precedentsLoading: boolean
  searchPrecedents: (query: string, filters?: {
    ginglesIssues?: GinglesIssue[]
    senateFactors?: SenateFactor[]
    circuits?: string[]
    courts?: string[]
    dateFrom?: string
    dateTo?: string
  }) => Promise<void>
  getPrecedent: (precedentId: string) => Promise<Precedent>
  compareCircuits: (issue: GinglesIssue, circuits: string[]) => Promise<CircuitComparisonResults>
  buildLegislativeHistory: (caseId: string, documentIds: string[]) => Promise<LegislativeHistoryTimeline>
  detectPatterns: (caseIds: string[]) => Promise<PatternAnalysisResults>
  getOpposingCounselIntel: (attorneyName: string) => Promise<OpposingCounselIntelligence>

  // Geographic Analysis
  geographicData: GeographicData[]
  geoDataLoading: boolean
  fetchGeographicData: (params?: { caseId?: string; geoType?: string }) => Promise<void>
  alignCensusData: (caseId: string, censusData: GeoJSON.FeatureCollection, precinctData: GeoJSON.FeatureCollection, h3Resolution: number) => Promise<string>
  calculateCompactness: (districtIds: string[], metrics: Array<'polsby_popper' | 'reock' | 'convex_hull' | 'schwartzberg' | 'length_width'>) => Promise<Array<{
    districtId: string
    metrics: Record<string, number>
  }>>
  analyzeGingles: (districtId: string) => Promise<GinglesAnalysis>
  exportGeographicData: (caseId: string, format: 'R' | 'Python' | 'Stata' | 'CSV', dataTypes: string[]) => Promise<Blob>
  geoJobRunning: boolean
  geoProgress: ProgressState

  // Expert Witnesses
  experts: ExpertWitness[]
  expertsLoading: boolean
  fetchExperts: (params?: ListExpertsRequest) => Promise<void>
  getExpert: (expertId: string) => Promise<ExpertWitness>
  createExpert: (data: {
    name: string
    credentials: string
    affiliation: string
    specialties: ExpertSpecialty[]
    cvUrl?: string
  }) => Promise<ExpertWitness>
  updateExpert: (expertId: string, data: Partial<ExpertWitness>) => Promise<ExpertWitness>
  deleteExpert: (expertId: string) => Promise<void>
  generateExpertReport: (caseId: string, templateType: string, data: Record<string, unknown>) => Promise<string>
  expertReportProgress: ProgressState

  // Deadlines
  deadlines: Deadline[]
  deadlinesLoading: boolean
  fetchDeadlines: (params?: ListDeadlinesRequest) => Promise<void>
  getDeadline: (deadlineId: string) => Promise<Deadline>
  createDeadline: (data: CreateDeadlineRequest) => Promise<Deadline>
  updateDeadline: (deadlineId: string, data: UpdateDeadlineRequest) => Promise<Deadline>
  deleteDeadline: (deadlineId: string) => Promise<void>
  checkDeadlineConflicts: (caseId: string) => Promise<DeadlineConflict[]>
  getUpcomingDeadlines: (daysAhead?: number) => Promise<Deadline[]>

  // Filters & UI
  caseTypeFilter: CaseType | 'all'
  statusFilter: CaseStatus | 'all'
  phaseFilter: CasePhase | 'all'
  searchQuery: string
  setCaseTypeFilter: (type: CaseType | 'all') => void
  setStatusFilter: (status: CaseStatus | 'all') => void
  setPhaseFilter: (phase: CasePhase | 'all') => void
  setSearchQuery: (query: string) => void
  filteredCases: DLCase[]

  // Job Polling
  pollJob: <T>(jobId: string, onProgress?: (progress: number, message: string) => void) => Promise<T>
  activeJobs: Map<string, Job>
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDemocracyLitigation(options: UseDemocracyLitigationOptions = {}): UseDemocracyLitigationReturn {
  const {
    autoFetchCases = false,
    autoFetchExperts = false,
    autoConnectSocket = true,
    caseId,
  } = options

  // Auth
  const token = useAuthToken()

  // Local state for client
  const [client, setClient] = useState<DemocracyLitigationClient | null>(null)
  const clientRef = useRef<DemocracyLitigationClient | null>(null)

  // Refs to prevent infinite re-fetch loops (React #185 fix)
  const hasFetchedCasesRef = useRef(false)
  const hasFetchedExpertsRef = useRef(false)
  const isFetchingRef = useRef(false)

  // Local state (in lieu of full Zustand store)
  const [cases, setCases] = useState<DLCase[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [casesError, setCasesError] = useState<string | null>(null)
  const [activeCase, setActiveCase] = useState<DLCase | null>(null)

  const [documents, setDocuments] = useState<DLDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<ProgressState>({ percent: 0, step: '', message: '' })

  const [triageResults, setTriageResults] = useState<TriageResults | null>(null)
  const [triageRunning, setTriageRunning] = useState(false)
  const [triageProgress, setTriageProgress] = useState<ProgressState>({ percent: 0, step: '', message: '' })

  const [precedents, setPrecedents] = useState<Precedent[]>([])
  const [precedentsLoading, setPrecedentsLoading] = useState(false)

  const [geographicData, setGeographicData] = useState<GeographicData[]>([])
  const [geoDataLoading, setGeoDataLoading] = useState(false)
  const [geoJobRunning, setGeoJobRunning] = useState(false)
  const [geoProgress, setGeoProgress] = useState<ProgressState>({ percent: 0, step: '', message: '' })

  const [experts, setExperts] = useState<ExpertWitness[]>([])
  const [expertsLoading, setExpertsLoading] = useState(false)
  const [expertReportProgress, setExpertReportProgress] = useState<ProgressState>({ percent: 0, step: '', message: '' })

  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(false)

  // Filters
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all')
  const [phaseFilter, setPhaseFilter] = useState<CasePhase | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Active jobs tracking
  const [activeJobs, setActiveJobs] = useState<Map<string, Job>>(new Map())

  // WebSocket connection state (mock for now - will be replaced when socket hook is created)
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [socketError, setSocketError] = useState<Error | null>(null)
  const isConnected = socketStatus === 'connected'

  // Initialize client when token is available
  useEffect(() => {
    if (token) {
      const newClient = createDemocracyLitigationClient(token)
      clientRef.current = newClient
      setClient(newClient)
      // Reset fetch flags when client is recreated
      hasFetchedCasesRef.current = false
      hasFetchedExpertsRef.current = false
    } else {
      clientRef.current = null
      setClient(null)
    }
  }, [token])

  // Auto-fetch cases - use ref to prevent re-fetch loops
  useEffect(() => {
    if (!autoFetchCases || !client || hasFetchedCasesRef.current) {
      return
    }
    hasFetchedCasesRef.current = true
    fetchCases()
  }, [autoFetchCases, client])

  // Auto-fetch experts - use ref to prevent re-fetch loops
  useEffect(() => {
    if (!autoFetchExperts || !client || hasFetchedExpertsRef.current) {
      return
    }
    hasFetchedExpertsRef.current = true
    fetchExperts()
  }, [autoFetchExperts, client])

  // ===========================================================================
  // API Methods - Cases
  // ===========================================================================

  /**
   * Fetch all cases with optional filtering
   * Uses refs to avoid dependency on state object (prevents React #185)
   */
  const fetchCases = useCallback(async (params?: ListCasesRequest) => {
    if (!clientRef.current || isFetchingRef.current) return
    isFetchingRef.current = true

    setCasesLoading(true)
    setCasesError(null)

    try {
      const response = await clientRef.current.listCases(params)
      if (response.success && response.data) {
        setCases(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to fetch cases')
      }
    } catch (error) {
      const message = error instanceof DemocracyLitigationError ? error.message : 'Failed to fetch cases'
      setCasesError(message)
    } finally {
      setCasesLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  /**
   * Create a new case
   */
  const createCase = useCallback(async (data: CreateCaseRequest): Promise<DLCase> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    setCasesLoading(true)
    try {
      const response = await clientRef.current.createCase(data)
      if (response.success && response.data) {
        setCases(prev => [...prev, response.data!])
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to create case')
    } finally {
      setCasesLoading(false)
    }
  }, [])

  /**
   * Update an existing case
   */
  const updateCase = useCallback(async (caseId: string, data: UpdateCaseRequest): Promise<DLCase> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    try {
      const response = await clientRef.current.updateCase(caseId, data)
      if (response.success && response.data) {
        setCases(prev => prev.map(c => c.id === caseId ? response.data! : c))
        if (activeCase?.id === caseId) {
          setActiveCase(response.data)
        }
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to update case')
    } catch (error) {
      const message = error instanceof DemocracyLitigationError ? error.message : 'Failed to update case'
      setCasesError(message)
      throw error
    }
  }, [activeCase])

  /**
   * Delete a case
   */
  const deleteCase = useCallback(async (caseId: string): Promise<void> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    try {
      const response = await clientRef.current.deleteCase(caseId)
      if (response.success) {
        setCases(prev => prev.filter(c => c.id !== caseId))
        if (activeCase?.id === caseId) {
          setActiveCase(null)
        }
      } else {
        throw new Error(response.error?.message || 'Failed to delete case')
      }
    } catch (error) {
      const message = error instanceof DemocracyLitigationError ? error.message : 'Failed to delete case'
      setCasesError(message)
      throw error
    }
  }, [activeCase])

  /**
   * Select and fetch a case
   */
  const selectCase = useCallback(async (caseId: string | null): Promise<void> => {
    if (!caseId) {
      setActiveCase(null)
      return
    }

    if (!clientRef.current) throw new Error('Not authenticated')

    setCasesLoading(true)
    try {
      const response = await clientRef.current.getCase(caseId)
      if (response.success && response.data) {
        setActiveCase(response.data)
      } else {
        throw new Error(response.error?.message || 'Failed to fetch case')
      }
    } catch (error) {
      const message = error instanceof DemocracyLitigationError ? error.message : 'Failed to fetch case'
      setCasesError(message)
      throw error
    } finally {
      setCasesLoading(false)
    }
  }, [])

  /**
   * Get case statistics
   */
  const getCaseStats = useCallback(async (caseId: string) => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getCaseStats(caseId)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to fetch case stats')
  }, [])

  // ===========================================================================
  // API Methods - Documents
  // ===========================================================================

  /**
   * Fetch documents with optional filtering
   */
  const fetchDocuments = useCallback(async (params?: ListDocumentsRequest) => {
    if (!clientRef.current) return

    setDocumentsLoading(true)
    setDocumentsError(null)

    try {
      const response = await clientRef.current.listDocuments(params)
      if (response.success && response.data) {
        setDocuments(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to fetch documents')
      }
    } catch (error) {
      const message = error instanceof DemocracyLitigationError ? error.message : 'Failed to fetch documents'
      setDocumentsError(message)
    } finally {
      setDocumentsLoading(false)
    }
  }, [])

  /**
   * Upload a document
   */
  const uploadDocument = useCallback(async (
    caseId: string,
    file: File,
    metadata?: {
      docType?: DocumentType
      docSubtype?: string
      tags?: string[]
    }
  ) => {
    if (!clientRef.current) throw new Error('Not authenticated')

    setUploadProgress({ percent: 0, step: 'Uploading', message: 'Uploading document...' })

    try {
      const response = await clientRef.current.uploadDocument(caseId, file, metadata)
      if (response.success && response.data) {
        setUploadProgress({ percent: 100, step: 'Complete', message: 'Upload complete' })
        // Refresh documents list
        fetchDocuments({ caseId })
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to upload document')
    } catch (error) {
      setUploadProgress({ percent: 0, step: 'Error', message: 'Upload failed' })
      throw error
    }
  }, [fetchDocuments])

  /**
   * Update document metadata
   */
  const updateDocument = useCallback(async (
    documentId: string,
    data: {
      docType?: DocumentType
      docSubtype?: string
      tags?: string[]
      relevanceScore?: number
    }
  ): Promise<DLDocument> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.updateDocument(documentId, data)
    if (response.success && response.data) {
      setDocuments(prev => prev.map(d => d.id === documentId ? response.data! : d))
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to update document')
  }, [])

  /**
   * Delete a document
   */
  const deleteDocument = useCallback(async (documentId: string): Promise<void> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.deleteDocument(documentId)
    if (response.success) {
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    } else {
      throw new Error(response.error?.message || 'Failed to delete document')
    }
  }, [])

  /**
   * Download a document
   */
  const downloadDocument = useCallback(async (documentId: string): Promise<Blob> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    return await clientRef.current.downloadDocument(documentId)
  }, [])

  // ===========================================================================
  // API Methods - Discovery Triage
  // ===========================================================================

  /**
   * Run discovery triage on documents
   */
  const triageDocuments = useCallback(async (
    caseId: string,
    documentIds: string[],
    settings?: {
      relevanceThreshold?: number
      privilegeThreshold?: number
      useMLModel?: boolean
    }
  ): Promise<string> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    setTriageRunning(true)
    setTriageProgress({ percent: 0, step: 'Starting', message: 'Initiating discovery triage...' })

    try {
      const response = await clientRef.current.triageDocuments({
        documentIds,
        triageSettings: settings,
      })
      if (response.success && response.data) {
        const jobId = response.data.jobId
        // Start polling for results
        pollTriageJob(jobId)
        return jobId
      }
      throw new Error(response.error?.message || 'Failed to start triage')
    } catch (error) {
      setTriageRunning(false)
      setTriageProgress({ percent: 0, step: 'Error', message: 'Triage failed to start' })
      throw error
    }
  }, [])

  /**
   * Poll triage job progress
   */
  const pollTriageJob = useCallback(async (jobId: string) => {
    if (!clientRef.current) return

    const pollInterval = 2000
    const maxDuration = 600000 // 10 minutes

    const startTime = Date.now()

    const poll = async () => {
      if (!clientRef.current || !triageRunning) return

      try {
        const response = await clientRef.current.getJobStatus<TriageResults>(jobId)
        if (!response.success || !response.data) {
          throw new Error('Failed to get triage status')
        }

        const job = response.data

        // Update progress
        const percent = job.progress
        setTriageProgress({
          percent,
          step: job.currentStep || 'Processing',
          message: job.message || `Processing documents...`,
        })

        // Check if complete
        if (job.status === 'completed' && job.result) {
          setTriageResults(job.result)
          setTriageRunning(false)
          setTriageProgress({ percent: 100, step: 'Complete', message: 'Triage complete!' })
          return
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          setTriageRunning(false)
          setTriageProgress({ percent: 0, step: 'Failed', message: job.errorMessage || 'Triage failed' })
          return
        }

        // Check timeout
        if (Date.now() - startTime > maxDuration) {
          setTriageRunning(false)
          setTriageProgress({ percent: 0, step: 'Timeout', message: 'Triage timed out' })
          return
        }

        // Continue polling
        setTimeout(poll, pollInterval)
      } catch (error) {
        setTriageRunning(false)
        setTriageProgress({
          percent: 0,
          step: 'Error',
          message: error instanceof Error ? error.message : 'Failed to poll status',
        })
      }
    }

    poll()
  }, [triageRunning])

  // ===========================================================================
  // API Methods - VRA Research
  // ===========================================================================

  /**
   * Search VRA precedents
   */
  const searchPrecedents = useCallback(async (
    query: string,
    filters?: {
      ginglesIssues?: GinglesIssue[]
      senateFactors?: SenateFactor[]
      circuits?: string[]
      courts?: string[]
      dateFrom?: string
      dateTo?: string
    }
  ) => {
    if (!clientRef.current) return

    setPrecedentsLoading(true)

    try {
      const response = await clientRef.current.searchVRAPrecedent({
        query,
        ...filters,
      })
      if (response.success && response.data) {
        setPrecedents(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to search precedents')
      }
    } catch (error) {
      console.error('Failed to search precedents:', error)
    } finally {
      setPrecedentsLoading(false)
    }
  }, [])

  /**
   * Get precedent by ID
   */
  const getPrecedent = useCallback(async (precedentId: string): Promise<Precedent> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getPrecedent(precedentId)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to fetch precedent')
  }, [])

  /**
   * Compare circuit court interpretations
   */
  const compareCircuits = useCallback(async (
    issue: GinglesIssue,
    circuits: string[]
  ): Promise<CircuitComparisonResults> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.compareCircuits({ issue, circuits })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to compare circuits')
  }, [])

  /**
   * Build legislative history timeline
   */
  const buildLegislativeHistory = useCallback(async (
    caseId: string,
    documentIds: string[]
  ): Promise<LegislativeHistoryTimeline> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.buildLegislativeHistory({ caseId, documentIds })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to build legislative history')
  }, [])

  /**
   * Detect patterns across cases
   */
  const detectPatterns = useCallback(async (caseIds: string[]): Promise<PatternAnalysisResults> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.detectPatterns(caseIds)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to detect patterns')
  }, [])

  /**
   * Get opposing counsel intelligence
   */
  const getOpposingCounselIntel = useCallback(async (
    attorneyName: string
  ): Promise<OpposingCounselIntelligence> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getOpposingCounselIntel(attorneyName)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to get counsel intel')
  }, [])

  // ===========================================================================
  // API Methods - Geographic Analysis
  // ===========================================================================

  /**
   * Fetch geographic data
   */
  const fetchGeographicData = useCallback(async (params?: { caseId?: string; geoType?: string }) => {
    if (!clientRef.current) return

    setGeoDataLoading(true)

    try {
      const response = await clientRef.current.listGeographicData(params)
      if (response.success && response.data) {
        setGeographicData(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to fetch geographic data')
      }
    } catch (error) {
      console.error('Failed to fetch geographic data:', error)
    } finally {
      setGeoDataLoading(false)
    }
  }, [])

  /**
   * Align census data to precincts
   */
  const alignCensusData = useCallback(async (
    caseId: string,
    censusData: GeoJSON.FeatureCollection,
    precinctData: GeoJSON.FeatureCollection,
    h3Resolution: number
  ): Promise<string> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    setGeoJobRunning(true)
    setGeoProgress({ percent: 0, step: 'Starting', message: 'Aligning census data...' })

    try {
      const response = await clientRef.current.alignCensusData({
        caseId,
        censusData,
        precinctData,
        h3Resolution,
      })
      if (response.success && response.data) {
        return response.data.jobId
      }
      throw new Error(response.error?.message || 'Failed to start census alignment')
    } catch (error) {
      setGeoJobRunning(false)
      setGeoProgress({ percent: 0, step: 'Error', message: 'Alignment failed' })
      throw error
    }
  }, [])

  /**
   * Calculate compactness metrics
   */
  const calculateCompactness = useCallback(async (
    districtIds: string[],
    metrics: Array<'polsby_popper' | 'reock' | 'convex_hull' | 'schwartzberg' | 'length_width'>
  ) => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.calculateCompactness({ districtIds, metrics })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to calculate compactness')
  }, [])

  /**
   * Analyze Gingles preconditions
   */
  const analyzeGingles = useCallback(async (districtId: string): Promise<GinglesAnalysis> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.analyzeGingles(districtId)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to analyze Gingles')
  }, [])

  /**
   * Export geographic data
   */
  const exportGeographicData = useCallback(async (
    caseId: string,
    format: 'R' | 'Python' | 'Stata' | 'CSV',
    dataTypes: string[]
  ): Promise<Blob> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    return await clientRef.current.exportGeographicData({ caseId, format, dataTypes })
  }, [])

  // ===========================================================================
  // API Methods - Expert Witnesses
  // ===========================================================================

  /**
   * Fetch experts with optional filtering
   */
  const fetchExperts = useCallback(async (params?: ListExpertsRequest) => {
    if (!clientRef.current) return

    setExpertsLoading(true)

    try {
      const response = await clientRef.current.listExperts(params)
      if (response.success && response.data) {
        setExperts(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to fetch experts')
      }
    } catch (error) {
      console.error('Failed to fetch experts:', error)
    } finally {
      setExpertsLoading(false)
    }
  }, [])

  /**
   * Get expert by ID
   */
  const getExpert = useCallback(async (expertId: string): Promise<ExpertWitness> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getExpert(expertId)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to fetch expert')
  }, [])

  /**
   * Create expert profile
   */
  const createExpert = useCallback(async (data: {
    name: string
    credentials: string
    affiliation: string
    specialties: ExpertSpecialty[]
    cvUrl?: string
  }): Promise<ExpertWitness> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.createExpert(data)
    if (response.success && response.data) {
      setExperts(prev => [...prev, response.data!])
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to create expert')
  }, [])

  /**
   * Update expert profile
   */
  const updateExpert = useCallback(async (
    expertId: string,
    data: Partial<ExpertWitness>
  ): Promise<ExpertWitness> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.updateExpert(expertId, data)
    if (response.success && response.data) {
      setExperts(prev => prev.map(e => e.id === expertId ? response.data! : e))
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to update expert')
  }, [])

  /**
   * Delete expert
   */
  const deleteExpert = useCallback(async (expertId: string): Promise<void> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.deleteExpert(expertId)
    if (response.success) {
      setExperts(prev => prev.filter(e => e.id !== expertId))
    } else {
      throw new Error(response.error?.message || 'Failed to delete expert')
    }
  }, [])

  /**
   * Generate expert report
   */
  const generateExpertReport = useCallback(async (
    caseId: string,
    templateType: string,
    data: Record<string, unknown>
  ): Promise<string> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    setExpertReportProgress({ percent: 0, step: 'Starting', message: 'Generating expert report...' })

    try {
      const response = await clientRef.current.generateExpertReport({ caseId, templateType, data })
      if (response.success && response.data) {
        return response.data.jobId
      }
      throw new Error(response.error?.message || 'Failed to generate report')
    } catch (error) {
      setExpertReportProgress({ percent: 0, step: 'Error', message: 'Report generation failed' })
      throw error
    }
  }, [])

  // ===========================================================================
  // API Methods - Deadlines
  // ===========================================================================

  /**
   * Fetch deadlines
   */
  const fetchDeadlines = useCallback(async (params?: ListDeadlinesRequest) => {
    if (!clientRef.current) return

    setDeadlinesLoading(true)

    try {
      const response = await clientRef.current.listDeadlines(params)
      if (response.success && response.data) {
        setDeadlines(response.data.data ?? [])
      } else {
        throw new Error(response.error?.message || 'Failed to fetch deadlines')
      }
    } catch (error) {
      console.error('Failed to fetch deadlines:', error)
    } finally {
      setDeadlinesLoading(false)
    }
  }, [])

  /**
   * Get deadline by ID
   */
  const getDeadline = useCallback(async (deadlineId: string): Promise<Deadline> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getDeadline(deadlineId)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to fetch deadline')
  }, [])

  /**
   * Create deadline
   */
  const createDeadline = useCallback(async (data: CreateDeadlineRequest): Promise<Deadline> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.createDeadline(data)
    if (response.success && response.data) {
      setDeadlines(prev => [...prev, response.data!])
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to create deadline')
  }, [])

  /**
   * Update deadline
   */
  const updateDeadline = useCallback(async (
    deadlineId: string,
    data: UpdateDeadlineRequest
  ): Promise<Deadline> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.updateDeadline(deadlineId, data)
    if (response.success && response.data) {
      setDeadlines(prev => prev.map(d => d.id === deadlineId ? response.data! : d))
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to update deadline')
  }, [])

  /**
   * Delete deadline
   */
  const deleteDeadline = useCallback(async (deadlineId: string): Promise<void> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.deleteDeadline(deadlineId)
    if (response.success) {
      setDeadlines(prev => prev.filter(d => d.id !== deadlineId))
    } else {
      throw new Error(response.error?.message || 'Failed to delete deadline')
    }
  }, [])

  /**
   * Check deadline conflicts
   */
  const checkDeadlineConflicts = useCallback(async (caseId: string): Promise<DeadlineConflict[]> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.checkDeadlineConflicts(caseId)
    if (response.success && response.data) {
      return response.data.conflicts
    }
    throw new Error(response.error?.message || 'Failed to check conflicts')
  }, [])

  /**
   * Get upcoming deadlines
   */
  const getUpcomingDeadlines = useCallback(async (daysAhead: number = 30): Promise<Deadline[]> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    const response = await clientRef.current.getUpcomingDeadlines(daysAhead)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error?.message || 'Failed to fetch upcoming deadlines')
  }, [])

  // ===========================================================================
  // Generic Job Polling
  // ===========================================================================

  /**
   * Generic job polling
   */
  const pollJob = useCallback(async <T,>(
    jobId: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<T> => {
    if (!clientRef.current) throw new Error('Not authenticated')

    return clientRef.current.pollJobUntilComplete<T>(jobId, {
      interval: 2000,
      timeout: 300000,
      onProgress: (job) => {
        onProgress?.(job.progress, job.message || '')
        // Track active jobs
        setActiveJobs(prev => new Map(prev).set(jobId, job))
      },
    }).then((job) => {
      // Remove from active jobs
      setActiveJobs(prev => {
        const next = new Map(prev)
        next.delete(jobId)
        return next
      })
      return job.result as T
    })
  }, [])

  // ===========================================================================
  // Computed Values
  // ===========================================================================

  /**
   * Filter cases based on current filters
   */
  const filteredCases = useMemo(() => {
    let filtered = cases

    // Apply case type filter
    if (caseTypeFilter !== 'all') {
      filtered = filtered.filter((c) => c.caseType === caseTypeFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter)
    }

    // Apply phase filter
    if (phaseFilter !== 'all') {
      filtered = filtered.filter((c) => c.phase === phaseFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.description || '').toLowerCase().includes(query) ||
          (c.tags || []).some((tag) => tag.toLowerCase().includes(query)) ||
          (c.caseNumber || '').toLowerCase().includes(query) ||
          c.courtName.toLowerCase().includes(query) ||
          c.jurisdiction.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [cases, caseTypeFilter, statusFilter, phaseFilter, searchQuery])

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // API Client
    client,

    // Connection State
    isConnected,
    socketStatus,
    socketError,

    // Cases
    cases,
    casesLoading,
    casesError,
    activeCase,
    fetchCases,
    createCase,
    updateCase,
    deleteCase,
    selectCase,
    getCaseStats,

    // Documents
    documents,
    documentsLoading,
    documentsError,
    fetchDocuments,
    uploadDocument,
    uploadProgress,
    updateDocument,
    deleteDocument,
    downloadDocument,

    // Discovery Triage
    triageDocuments,
    triageResults,
    triageRunning,
    triageProgress,

    // VRA Research
    precedents,
    precedentsLoading,
    searchPrecedents,
    getPrecedent,
    compareCircuits,
    buildLegislativeHistory,
    detectPatterns,
    getOpposingCounselIntel,

    // Geographic Analysis
    geographicData,
    geoDataLoading,
    fetchGeographicData,
    alignCensusData,
    calculateCompactness,
    analyzeGingles,
    exportGeographicData,
    geoJobRunning,
    geoProgress,

    // Expert Witnesses
    experts,
    expertsLoading,
    fetchExperts,
    getExpert,
    createExpert,
    updateExpert,
    deleteExpert,
    generateExpertReport,
    expertReportProgress,

    // Deadlines
    deadlines,
    deadlinesLoading,
    fetchDeadlines,
    getDeadline,
    createDeadline,
    updateDeadline,
    deleteDeadline,
    checkDeadlineConflicts,
    getUpcomingDeadlines,

    // Filters & UI
    caseTypeFilter,
    statusFilter,
    phaseFilter,
    searchQuery,
    setCaseTypeFilter,
    setStatusFilter,
    setPhaseFilter,
    setSearchQuery,
    filteredCases,

    // Job Polling
    pollJob,
    activeJobs,
  }
}

export default useDemocracyLitigation
