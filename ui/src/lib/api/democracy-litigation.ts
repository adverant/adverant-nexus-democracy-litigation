/**
 * Democracy Litigation Plugin API Client
 *
 * Complete TypeScript client for the Democracy Litigation service.
 * Handles all API endpoints with proper error handling and type safety.
 *
 * @module democracy-litigation-client
 */

import type {
  DLCase,
  DLDocument,
  Precedent,
  GeographicData,
  ExpertWitness,
  Deadline,
  Job,
  JobStatus,
  ApiResponse,
  PaginatedResponse,
  CreateCaseRequest,
  UpdateCaseRequest,
  ListCasesRequest,
  UploadDocumentRequest,
  ListDocumentsRequest,
  TriageDocumentsRequest,
  VRASearchRequest,
  CircuitComparisonRequest,
  LegislativeHistoryRequest,
  CensusAlignmentRequest,
  CompactnessRequest,
  GeoExportRequest,
  ListExpertsRequest,
  GenerateExpertReportRequest,
  CreateDeadlineRequest,
  UpdateDeadlineRequest,
  ListDeadlinesRequest,
  GinglesAnalysis,
  TriageResults,
  CircuitComparisonResults,
  LegislativeHistoryTimeline,
  PatternAnalysisResults,
  OpposingCounselIntelligence,
  DeadlineConflict,
  CaseType,
  CaseStatus,
  DocumentType,
  ProcessingStatus,
  GinglesIssue,
  SenateFactor,
  ExpertSpecialty,
  DeadlineType,
  DeadlinePriority,
  JobType,
} from '@/types/democracy-litigation';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const LONG_TIMEOUT_MS = 120000; // 2 minutes for heavy operations
const UPLOAD_TIMEOUT_MS = 60000; // 60 seconds for file uploads
const API_BASE_URL =
  process.env.NEXT_PUBLIC_DEMOCRACY_LITIGATION_URL ||
  'https://api.adverant.ai/democracy-litigation/api/v1';

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Error class for Democracy Litigation API errors
 */
export class DemocracyLitigationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DemocracyLitigationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DemocracyLitigationError);
    }
  }

  /**
   * Create error from HTTP response
   */
  static fromResponse(
    statusCode: number,
    data: { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
  ): DemocracyLitigationError {
    return new DemocracyLitigationError(
      data?.error?.message || `HTTP ${statusCode}`,
      data?.error?.code || 'HTTP_ERROR',
      statusCode,
      data?.error?.details
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build query string from parameters object
 */
function buildQueryString(params: Record<string, unknown>): string {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, String(v)));
      } else if (value instanceof Date) {
        queryParams.append(key, value.toISOString());
      } else {
        queryParams.append(key, String(value));
      }
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Transform snake_case keys to camelCase
 */
function toCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(value);
    }
    return result;
  }

  return obj;
}

/**
 * Transform camelCase keys to snake_case
 */
function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(value);
    }
    return result;
  }

  return obj;
}

// ============================================================================
// Democracy Litigation Client Class
// ============================================================================

/**
 * API client for Democracy Litigation service
 */
export class DemocracyLitigationClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(
    token?: string,
    options?: {
      baseUrl?: string;
      timeout?: number;
      userId?: string;
    }
  ) {
    this.baseUrl = options?.baseUrl || API_BASE_URL;
    this.timeout = options?.timeout || DEFAULT_TIMEOUT_MS;

    this.headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
    }

    if (options?.userId) {
      this.headers['X-User-ID'] = options.userId;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Generic request handler with error handling, timeout, and retries
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options?: { timeout?: number; retries?: number }
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = options?.retries || 0;
    const timeoutMs = options?.timeout || this.timeout;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(toSnakeCase(body)) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle rate limiting with retry
          if (response.status === 429 && attempt < maxRetries) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }

          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: { message: response.statusText || 'Request failed' } };
          }
          throw DemocracyLitigationError.fromResponse(response.status, errorData);
        }

        // Handle 204 No Content
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return null as unknown as T;
        }

        const text = await response.text();
        if (!text) return null as unknown as T;

        const data = JSON.parse(text);
        return toCamelCase(data) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DemocracyLitigationError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new DemocracyLitigationError(
            `Request timed out after ${timeoutMs}ms`,
            'TIMEOUT',
            408
          ) as Error;
        } else if (error instanceof TypeError) {
          lastError = new DemocracyLitigationError(
            'Network error. Please check your connection.',
            'NETWORK_ERROR',
            0
          ) as Error;
        } else {
          lastError = new DemocracyLitigationError(
            error instanceof Error ? error.message : 'Unknown error occurred',
            'UNKNOWN_ERROR',
            0
          ) as Error;
        }

        // Retry on network errors
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError || new DemocracyLitigationError('Request failed', 'REQUEST_FAILED', 0);
  }

  // ==========================================================================
  // Health & Info
  // ==========================================================================

  /**
   * Check API health status
   * Note: Health endpoint is at root level, not under /api/v1
   */
  async getHealth(): Promise<{ status: string; service: string; version: string }> {
    const healthUrl = this.baseUrl.replace('/api/v1', '/health');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw DemocracyLitigationError.fromResponse(response.status, {});
      }

      const data = await response.json();
      return data as { status: string; service: string; version: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DemocracyLitigationError) throw error;
      throw new DemocracyLitigationError(
        'Health check failed',
        'HEALTH_CHECK_FAILED',
        0
      );
    }
  }

  // ==========================================================================
  // Case Management
  // ==========================================================================

  /**
   * List all cases with optional filtering
   */
  async listCases(
    params?: ListCasesRequest
  ): Promise<ApiResponse<PaginatedResponse<DLCase>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/cases${queryString}`);
  }

  /**
   * Get a single case by ID
   */
  async getCase(caseId: string): Promise<ApiResponse<DLCase>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/cases/${caseId}`);
  }

  /**
   * Create a new case
   */
  async createCase(data: CreateCaseRequest): Promise<ApiResponse<DLCase>> {
    if (!data.name || data.name.trim().length === 0) {
      throw new DemocracyLitigationError('Case name is required', 'INVALID_PARAM', 400);
    }
    if (!data.courtName || data.courtName.trim().length === 0) {
      throw new DemocracyLitigationError('Court name is required', 'INVALID_PARAM', 400);
    }
    if (!data.jurisdiction || data.jurisdiction.trim().length === 0) {
      throw new DemocracyLitigationError('Jurisdiction is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/cases', data);
  }

  /**
   * Update an existing case
   */
  async updateCase(
    caseId: string,
    data: UpdateCaseRequest
  ): Promise<ApiResponse<DLCase>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('PATCH', `/cases/${caseId}`, data);
  }

  /**
   * Delete a case (soft delete)
   */
  async deleteCase(caseId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('DELETE', `/cases/${caseId}`);
  }

  /**
   * Get case statistics and summary
   */
  async getCaseStats(caseId: string): Promise<ApiResponse<{
    documentCount: number;
    researchItems: number;
    expertReports: number;
    upcomingDeadlines: number;
    completionPercent: number;
    recentActivity: Array<{
      type: string;
      description: string;
      timestamp: string;
    }>;
  }>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/cases/${caseId}/stats`);
  }

  // ==========================================================================
  // Document Management
  // ==========================================================================

  /**
   * List documents with optional filtering
   */
  async listDocuments(
    params?: ListDocumentsRequest
  ): Promise<ApiResponse<PaginatedResponse<DLDocument>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/documents${queryString}`);
  }

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string): Promise<ApiResponse<DLDocument>> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/documents/${documentId}`);
  }

  /**
   * Upload a document file
   */
  async uploadDocument(
    caseId: string,
    file: File,
    metadata?: {
      docType?: DocumentType;
      docSubtype?: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<{ documentId: string; filename: string; status: string }>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!file) {
      throw new DemocracyLitigationError('File is required', 'INVALID_PARAM', 400);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);

    if (metadata?.docType) {
      formData.append('doc_type', metadata.docType);
    }
    if (metadata?.docSubtype) {
      formData.append('doc_subtype', metadata.docSubtype);
    }
    if (metadata?.tags && metadata.tags.length > 0) {
      formData.append('tags', JSON.stringify(metadata.tags));
    }

    const url = `${this.baseUrl}/documents/upload`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {};
      if (this.headers['Authorization']) {
        headers['Authorization'] = this.headers['Authorization'];
      }
      if (this.headers['X-User-ID']) {
        headers['X-User-ID'] = this.headers['X-User-ID'];
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw DemocracyLitigationError.fromResponse(response.status, errorData);
      }

      const data = await response.json();
      return toCamelCase(data) as ApiResponse<{
        documentId: string;
        filename: string;
        status: string;
      }>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DemocracyLitigationError) throw error;
      throw new DemocracyLitigationError(
        error instanceof Error ? error.message : 'Upload failed',
        'UPLOAD_ERROR',
        0
      );
    }
  }

  /**
   * Download a document file
   */
  async downloadDocument(documentId: string): Promise<Blob> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }

    const url = `${this.baseUrl}/documents/${documentId}/download`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw DemocracyLitigationError.fromResponse(response.status, errorData);
      }

      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DemocracyLitigationError) throw error;
      throw new DemocracyLitigationError(
        error instanceof Error ? error.message : 'Download failed',
        'DOWNLOAD_ERROR',
        0
      );
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    data: {
      docType?: DocumentType;
      docSubtype?: string;
      tags?: string[];
      relevanceScore?: number;
    }
  ): Promise<ApiResponse<DLDocument>> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('PATCH', `/documents/${documentId}`, data);
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('DELETE', `/documents/${documentId}`);
  }

  /**
   * Trigger OCR processing for a document
   */
  async processDocumentOCR(
    documentId: string
  ): Promise<ApiResponse<{ jobId: string; status: string }>> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', `/documents/${documentId}/ocr`, {}, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Extract entities from document
   */
  async extractEntities(
    documentId: string
  ): Promise<ApiResponse<{ jobId: string; status: string }>> {
    if (!documentId) {
      throw new DemocracyLitigationError('Document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', `/documents/${documentId}/extract-entities`, {}, { timeout: LONG_TIMEOUT_MS });
  }

  // ==========================================================================
  // Discovery Triage
  // ==========================================================================

  /**
   * Run AI-powered discovery triage on multiple documents
   */
  async triageDocuments(
    data: TriageDocumentsRequest
  ): Promise<ApiResponse<{ jobId: string; status: string; documentCount: number }>> {
    if (!data.documentIds || data.documentIds.length === 0) {
      throw new DemocracyLitigationError('At least one document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/triage/documents', data, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Get triage results
   */
  async getTriageResults(jobId: string): Promise<ApiResponse<TriageResults>> {
    if (!jobId) {
      throw new DemocracyLitigationError('Job ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/triage/jobs/${jobId}`);
  }

  // ==========================================================================
  // VRA Research & Precedent
  // ==========================================================================

  /**
   * Search VRA case law database
   */
  async searchVRAPrecedent(
    data: VRASearchRequest
  ): Promise<ApiResponse<PaginatedResponse<Precedent>>> {
    if (!data.query || data.query.trim().length === 0) {
      throw new DemocracyLitigationError('Search query is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/research/vra-search', data, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Get precedent by ID
   */
  async getPrecedent(precedentId: string): Promise<ApiResponse<Precedent>> {
    if (!precedentId) {
      throw new DemocracyLitigationError('Precedent ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/research/precedents/${precedentId}`);
  }

  /**
   * Compare circuit court interpretations
   */
  async compareCircuits(
    data: CircuitComparisonRequest
  ): Promise<ApiResponse<CircuitComparisonResults>> {
    if (!data.issue) {
      throw new DemocracyLitigationError('Gingles issue is required', 'INVALID_PARAM', 400);
    }
    if (!data.circuits || data.circuits.length === 0) {
      throw new DemocracyLitigationError('At least one circuit is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/research/circuit-comparison', data, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Build legislative history timeline
   */
  async buildLegislativeHistory(
    data: LegislativeHistoryRequest
  ): Promise<ApiResponse<LegislativeHistoryTimeline>> {
    if (!data.caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.documentIds || data.documentIds.length === 0) {
      throw new DemocracyLitigationError('At least one document ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/research/legislative-history', data, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Detect patterns across cases
   */
  async detectPatterns(
    caseIds: string[]
  ): Promise<ApiResponse<PatternAnalysisResults>> {
    if (!caseIds || caseIds.length === 0) {
      throw new DemocracyLitigationError('At least one case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/research/pattern-detection', { caseIds }, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Get opposing counsel intelligence
   */
  async getOpposingCounselIntel(
    attorneyName: string
  ): Promise<ApiResponse<OpposingCounselIntelligence>> {
    if (!attorneyName || attorneyName.trim().length === 0) {
      throw new DemocracyLitigationError('Attorney name is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/research/opposing-counsel', { attorneyName }, { timeout: LONG_TIMEOUT_MS });
  }

  // ==========================================================================
  // Geographic Analysis
  // ==========================================================================

  /**
   * List geographic data
   */
  async listGeographicData(
    params?: {
      caseId?: string;
      geoType?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ApiResponse<PaginatedResponse<GeographicData>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/geographic${queryString}`);
  }

  /**
   * Get geographic data by ID
   */
  async getGeographicData(geoId: string): Promise<ApiResponse<GeographicData>> {
    if (!geoId) {
      throw new DemocracyLitigationError('Geographic ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/geographic/${geoId}`);
  }

  /**
   * Align census data to precinct boundaries
   */
  async alignCensusData(
    data: CensusAlignmentRequest
  ): Promise<ApiResponse<{ jobId: string; status: string }>> {
    if (!data.caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.censusData || !data.precinctData) {
      throw new DemocracyLitigationError('Census data and precinct data are required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/geographic/align-census', data, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Calculate compactness metrics for districts
   */
  async calculateCompactness(
    data: CompactnessRequest
  ): Promise<ApiResponse<Array<{
    districtId: string;
    metrics: Record<string, number>;
  }>>> {
    if (!data.districtIds || data.districtIds.length === 0) {
      throw new DemocracyLitigationError('At least one district ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.metrics || data.metrics.length === 0) {
      throw new DemocracyLitigationError('At least one metric is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/geographic/compactness', data);
  }

  /**
   * Run Gingles precondition analysis
   */
  async analyzeGingles(
    districtId: string
  ): Promise<ApiResponse<GinglesAnalysis>> {
    if (!districtId) {
      throw new DemocracyLitigationError('District ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/geographic/gingles-analysis', { districtId }, { timeout: LONG_TIMEOUT_MS });
  }

  /**
   * Export geographic data for expert analysis
   */
  async exportGeographicData(
    data: GeoExportRequest
  ): Promise<Blob> {
    if (!data.caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.format) {
      throw new DemocracyLitigationError('Export format is required', 'INVALID_PARAM', 400);
    }

    const url = `${this.baseUrl}/geographic/export`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LONG_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(toSnakeCase(data)),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw DemocracyLitigationError.fromResponse(response.status, errorData);
      }

      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DemocracyLitigationError) throw error;
      throw new DemocracyLitigationError(
        error instanceof Error ? error.message : 'Export failed',
        'EXPORT_ERROR',
        0
      );
    }
  }

  // ==========================================================================
  // Expert Witness Management
  // ==========================================================================

  /**
   * List expert witnesses
   */
  async listExperts(
    params?: ListExpertsRequest
  ): Promise<ApiResponse<PaginatedResponse<ExpertWitness>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/experts${queryString}`);
  }

  /**
   * Get expert witness by ID
   */
  async getExpert(expertId: string): Promise<ApiResponse<ExpertWitness>> {
    if (!expertId) {
      throw new DemocracyLitigationError('Expert ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/experts/${expertId}`);
  }

  /**
   * Create expert witness profile
   */
  async createExpert(
    data: {
      name: string;
      credentials: string;
      affiliation: string;
      specialties: ExpertSpecialty[];
      cvUrl?: string;
    }
  ): Promise<ApiResponse<ExpertWitness>> {
    if (!data.name || data.name.trim().length === 0) {
      throw new DemocracyLitigationError('Expert name is required', 'INVALID_PARAM', 400);
    }
    if (!data.specialties || data.specialties.length === 0) {
      throw new DemocracyLitigationError('At least one specialty is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/experts', data);
  }

  /**
   * Update expert witness profile
   */
  async updateExpert(
    expertId: string,
    data: Partial<ExpertWitness>
  ): Promise<ApiResponse<ExpertWitness>> {
    if (!expertId) {
      throw new DemocracyLitigationError('Expert ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('PATCH', `/experts/${expertId}`, data);
  }

  /**
   * Delete expert witness
   */
  async deleteExpert(expertId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!expertId) {
      throw new DemocracyLitigationError('Expert ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('DELETE', `/experts/${expertId}`);
  }

  /**
   * Generate expert report
   */
  async generateExpertReport(
    data: GenerateExpertReportRequest
  ): Promise<ApiResponse<{ jobId: string; status: string }>> {
    if (!data.caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.templateType) {
      throw new DemocracyLitigationError('Template type is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/experts/generate-report', data, { timeout: LONG_TIMEOUT_MS });
  }

  // ==========================================================================
  // Deadline Management
  // ==========================================================================

  /**
   * List deadlines
   */
  async listDeadlines(
    params?: ListDeadlinesRequest
  ): Promise<ApiResponse<PaginatedResponse<Deadline>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/deadlines${queryString}`);
  }

  /**
   * Get deadline by ID
   */
  async getDeadline(deadlineId: string): Promise<ApiResponse<Deadline>> {
    if (!deadlineId) {
      throw new DemocracyLitigationError('Deadline ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/deadlines/${deadlineId}`);
  }

  /**
   * Create a new deadline
   */
  async createDeadline(data: CreateDeadlineRequest): Promise<ApiResponse<Deadline>> {
    if (!data.caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    if (!data.title || data.title.trim().length === 0) {
      throw new DemocracyLitigationError('Deadline title is required', 'INVALID_PARAM', 400);
    }
    if (!data.deadlineDate) {
      throw new DemocracyLitigationError('Deadline date is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', '/deadlines', data);
  }

  /**
   * Update a deadline
   */
  async updateDeadline(
    deadlineId: string,
    data: UpdateDeadlineRequest
  ): Promise<ApiResponse<Deadline>> {
    if (!deadlineId) {
      throw new DemocracyLitigationError('Deadline ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('PATCH', `/deadlines/${deadlineId}`, data);
  }

  /**
   * Delete a deadline
   */
  async deleteDeadline(deadlineId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!deadlineId) {
      throw new DemocracyLitigationError('Deadline ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('DELETE', `/deadlines/${deadlineId}`);
  }

  /**
   * Check for deadline conflicts
   */
  async checkDeadlineConflicts(
    caseId: string
  ): Promise<ApiResponse<{ conflicts: DeadlineConflict[] }>> {
    if (!caseId) {
      throw new DemocracyLitigationError('Case ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/deadlines/conflicts/${caseId}`);
  }

  /**
   * Get upcoming deadlines across all cases
   */
  async getUpcomingDeadlines(
    daysAhead: number = 30
  ): Promise<ApiResponse<Deadline[]>> {
    return this.request('GET', `/deadlines/upcoming?days=${daysAhead}`);
  }

  // ==========================================================================
  // Job Management
  // ==========================================================================

  /**
   * Get job status
   */
  async getJobStatus<T = unknown>(
    jobId: string
  ): Promise<ApiResponse<Job<T>>> {
    if (!jobId) {
      throw new DemocracyLitigationError('Job ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('GET', `/jobs/${jobId}`);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    if (!jobId) {
      throw new DemocracyLitigationError('Job ID is required', 'INVALID_PARAM', 400);
    }
    return this.request('POST', `/jobs/${jobId}/cancel`);
  }

  /**
   * List jobs for a case
   */
  async listJobs(
    params?: {
      caseId?: string;
      jobType?: JobType;
      status?: JobStatus;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ApiResponse<PaginatedResponse<Job>>> {
    const queryString = params ? buildQueryString(params as Record<string, unknown>) : '';
    return this.request('GET', `/jobs${queryString}`);
  }

  /**
   * Poll job until completion
   */
  async pollJobUntilComplete<T = unknown>(
    jobId: string,
    options?: {
      interval?: number;
      timeout?: number;
      onProgress?: (job: Job<T>) => void;
    }
  ): Promise<Job<T>> {
    const pollInterval = options?.interval || 2000;
    const maxTimeout = options?.timeout || 300000; // 5 minutes default
    const startTime = Date.now();

    while (Date.now() - startTime < maxTimeout) {
      const response = await this.getJobStatus<T>(jobId);

      if (!response.success || !response.data) {
        throw new DemocracyLitigationError('Failed to get job status', 'JOB_STATUS_ERROR', 500);
      }

      const job = response.data;

      if (options?.onProgress) {
        options.onProgress(job);
      }

      if (job.status === 'completed') {
        return job;
      }

      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new DemocracyLitigationError(
          job.errorMessage || `Job ${job.status}`,
          `JOB_${job.status.toUpperCase()}`,
          500
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new DemocracyLitigationError(
      `Job polling timed out after ${maxTimeout}ms`,
      'JOB_TIMEOUT',
      408
    );
  }
}

// ============================================================================
// Factory Function & Singleton
// ============================================================================

let clientInstance: DemocracyLitigationClient | null = null;

/**
 * Get or create Democracy Litigation client instance
 *
 * @param token - JWT access token
 * @param userId - Optional user ID for tracking
 * @returns Configured Democracy Litigation client
 *
 * @example
 * ```typescript
 * const client = getDemocracyLitigationClient(accessToken);
 * const cases = await client.listCases();
 * ```
 */
export function getDemocracyLitigationClient(
  token?: string,
  userId?: string
): DemocracyLitigationClient {
  // Create new instance if token/userId changed or first call
  if (!clientInstance || token || userId) {
    clientInstance = new DemocracyLitigationClient(token, { userId });
  }
  return clientInstance;
}

/**
 * Create a new Democracy Litigation client instance (non-singleton)
 *
 * @param token - JWT access token
 * @param options - Client options
 * @returns New Democracy Litigation client instance
 */
export function createDemocracyLitigationClient(
  token?: string,
  options?: {
    baseUrl?: string;
    timeout?: number;
    userId?: string;
  }
): DemocracyLitigationClient {
  return new DemocracyLitigationClient(token, options);
}

// ============================================================================
// Type Re-exports
// ============================================================================

export type {
  DLCase,
  DLDocument,
  Precedent,
  GeographicData,
  ExpertWitness,
  Deadline,
  Job,
  JobStatus,
  ApiResponse,
  PaginatedResponse,
  CreateCaseRequest,
  UpdateCaseRequest,
  ListCasesRequest,
  UploadDocumentRequest,
  ListDocumentsRequest,
  TriageDocumentsRequest,
  VRASearchRequest,
  CircuitComparisonRequest,
  LegislativeHistoryRequest,
  CensusAlignmentRequest,
  CompactnessRequest,
  GeoExportRequest,
  ListExpertsRequest,
  GenerateExpertReportRequest,
  CreateDeadlineRequest,
  UpdateDeadlineRequest,
  ListDeadlinesRequest,
  GinglesAnalysis,
  TriageResults,
  CircuitComparisonResults,
  LegislativeHistoryTimeline,
  PatternAnalysisResults,
  OpposingCounselIntelligence,
  DeadlineConflict,
  CaseType,
  CaseStatus,
  DocumentType,
  ProcessingStatus,
  GinglesIssue,
  SenateFactor,
  ExpertSpecialty,
  DeadlineType,
  DeadlinePriority,
  JobType,
};
