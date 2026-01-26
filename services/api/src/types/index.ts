/**
 * Democracy Litigation API - Backend Type Definitions
 *
 * Complete type system for backend API service
 */

import { Request } from 'express';

// ============================================
// Database Types (matching PostgreSQL schema)
// ============================================

export type CaseType =
  | 'redistricting'
  | 'voter_id'
  | 'ballot_access'
  | 'voter_purges'
  | 'direct_democracy'
  | 'poll_closures'
  | 'drop_box_restrictions'
  | 'early_voting'
  | 'absentee_voting';

export type CaseStatus =
  | 'active'
  | 'settled'
  | 'dismissed'
  | 'won'
  | 'lost'
  | 'on_hold'
  | 'appeal'
  | 'remanded';

export type CasePhase =
  | 'discovery'
  | 'motion_practice'
  | 'trial_prep'
  | 'trial'
  | 'appeal'
  | 'remedy'
  | 'implementation'
  | 'monitoring';

export type DocumentType =
  | 'court_filing'
  | 'discovery'
  | 'expert_report'
  | 'deposition'
  | 'legislative_record'
  | 'census_data'
  | 'election_results'
  | 'correspondence'
  | 'research'
  | 'other';

export type DeadlineType =
  | 'filing'
  | 'discovery'
  | 'motion'
  | 'hearing'
  | 'trial'
  | 'appeal'
  | 'response'
  | 'expert_report'
  | 'custom';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type ExpertSpecialty =
  | 'statistician'
  | 'demographer'
  | 'political_scientist'
  | 'historian'
  | 'economist'
  | 'cartographer';

export type GinglesIssue =
  | 'numerosity_compactness'
  | 'political_cohesion'
  | 'bloc_voting';

export type SenateFactor =
  | 'history_of_discrimination'
  | 'racially_polarized_voting'
  | 'use_of_devices'
  | 'candidate_slating'
  | 'discrimination_in_education'
  | 'socioeconomic_disparities'
  | 'racial_appeals'
  | 'minority_elected_officials'
  | 'unresponsiveness';

// ============================================
// Database Entity Interfaces
// ============================================

export interface DBCase {
  id: string;
  user_id: string;
  name: string;
  case_number: string | null;
  case_type: CaseType;
  status: CaseStatus;
  phase: CasePhase;
  court_name: string | null;
  jurisdiction: string | null;
  plaintiffs: Record<string, unknown>[];
  defendants: Record<string, unknown>[];
  counsel: Record<string, unknown>[];
  legal_claims: string[];
  filing_date: Date | null;
  trial_date: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DBDocument {
  id: string;
  case_id: string;
  user_id: string;
  filename: string;
  file_size_bytes: number;
  storage_path: string;
  doc_type: DocumentType;
  tags: string[];
  ocr_text: string | null;
  relevance_score: number | null;
  privilege_score: number | null;
  triage_status: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: Date;
}

export interface DBPrecedent {
  id: string;
  case_name: string;
  citation: string;
  circuit: string | null;
  court_level: string | null;
  decision_date: Date | null;
  gingles_issues: GinglesIssue[];
  senate_factors: SenateFactor[];
  holding: string | null;
  majority_opinion_text: string | null;
  dissenting_opinion_text: string | null;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface DBGeographicData {
  id: string;
  case_id: string;
  data_type: string;
  geometry: unknown; // PostGIS GEOMETRY type
  properties: Record<string, unknown>;
  h3_resolution9: string | null;
  created_at: Date;
}

export interface DBExpertWitness {
  id: string;
  name: string;
  affiliation: string | null;
  specialty: ExpertSpecialty;
  bio: string | null;
  cv_url: string | null;
  testimony_count: number;
  daubert_challenges: number;
  daubert_successes: number;
  track_record: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface DBDeadline {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  deadline_date: Date;
  deadline_type: DeadlineType;
  priority: Priority;
  status: string;
  alert_intervals: number[];
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface DBJob {
  id: string;
  case_id: string | null;
  user_id: string;
  job_type: string;
  status: string;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface DBLegislativeHistory {
  id: string;
  case_id: string;
  document_ids: string[];
  timeline: Record<string, unknown>;
  actors: Record<string, unknown>[];
  key_moments: Record<string, unknown>[];
  discriminatory_patterns: Record<string, unknown>[];
  created_at: Date;
}

export interface DBTriageResult {
  id: string;
  document_id: string;
  relevance_score: number;
  relevance_reasons: string[];
  privilege_score: number;
  privilege_indicators: string[];
  classification: string;
  created_at: Date;
}

export interface DBCompactnessMetrics {
  id: string;
  case_id: string;
  district_id: string;
  geometry: unknown;
  polsby_popper: number | null;
  reock: number | null;
  convex_hull_ratio: number | null;
  calculated_at: Date;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ListCasesRequest {
  page?: number;
  limit?: number;
  status?: CaseStatus;
  case_type?: CaseType;
  phase?: CasePhase;
  search?: string;
}

export interface CreateCaseRequest {
  name: string;
  case_type: CaseType;
  court_name?: string;
  jurisdiction?: string;
  plaintiffs?: Record<string, unknown>[];
  defendants?: Record<string, unknown>[];
  counsel?: Record<string, unknown>[];
  legal_claims?: string[];
  filing_date?: string;
}

export interface UpdateCaseRequest {
  name?: string;
  case_number?: string;
  status?: CaseStatus;
  phase?: CasePhase;
  court_name?: string;
  jurisdiction?: string;
  plaintiffs?: Record<string, unknown>[];
  defendants?: Record<string, unknown>[];
  counsel?: Record<string, unknown>[];
  legal_claims?: string[];
  filing_date?: string;
  trial_date?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentRequest {
  case_id: string;
  doc_type: DocumentType;
  tags?: string[];
}

export interface TriageDocumentsRequest {
  document_ids: string[];
  relevance_threshold?: number;
  privilege_threshold?: number;
}

export interface VRASearchRequest {
  query: string;
  gingles_issues?: GinglesIssue[];
  senate_factors?: SenateFactor[];
  circuits?: string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface CompactnessRequest {
  geometry: Record<string, unknown>;
  metrics: string[];
}

export interface H3AlignmentRequest {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  resolution: number;
}

export interface CreateDeadlineRequest {
  case_id: string;
  title: string;
  deadline_date: string;
  deadline_type: DeadlineType;
  priority: Priority;
  alert_intervals?: number[];
  metadata?: Record<string, unknown>;
}

export interface CreateExpertRequest {
  name: string;
  affiliation?: string;
  specialty: ExpertSpecialty;
  bio?: string;
  cv_url?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// ============================================
// Service Layer Types
// ============================================

export interface GraphRAGSearchResult {
  precedents: Array<{
    id: string;
    case_name: string;
    citation: string;
    circuit: string;
    gingles_issues: GinglesIssue[];
    senate_factors: SenateFactor[];
    holding: string;
    relevance_score: number;
    metadata: Record<string, unknown>;
  }>;
  total: number;
}

export interface CircuitComparison {
  issue: GinglesIssue | SenateFactor;
  circuits: Array<{
    circuit: string;
    case_count: number;
    plaintiff_success_rate: number;
    key_precedents: string[];
    summary: string;
  }>;
}

export interface DocAITriageResult {
  document_id: string;
  relevance_score: number;
  relevance_reasons: string[];
  privilege_score: number;
  privilege_indicators: string[];
  classification: string;
  key_entities: Array<{
    type: string;
    text: string;
    confidence: number;
  }>;
}

export interface LegislativeTimeline {
  events: Array<{
    date: string;
    event_type: string;
    description: string;
    actors: string[];
    document_ids: string[];
    significance: number;
  }>;
  actors: Array<{
    name: string;
    role: string;
    party: string;
    statements: number;
  }>;
  key_moments: Array<{
    date: string;
    title: string;
    description: string;
    discriminatory_indicators: string[];
  }>;
}

export interface CompactnessMetrics {
  polsby_popper: number;
  reock: number;
  convex_hull_ratio: number;
  perimeter: number;
  area: number;
}

export interface H3AlignmentResult {
  crosswalk: Array<{
    source_id: string;
    target_id: string;
    h3_index: string;
    weight: number;
  }>;
  quality_metrics: {
    coverage: number;
    accuracy: number;
    resolution: number;
  };
}

// ============================================
// WebSocket Types
// ============================================

export type WebSocketEventType =
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'document:uploaded'
  | 'document:triaged'
  | 'deadline:approaching'
  | 'case:updated';

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: unknown;
  timestamp: string;
}

// ============================================
// Authentication & Authorization
// ============================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tier: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// ============================================
// Job Queue Types
// ============================================

export type JobType =
  | 'document_triage'
  | 'legislative_history'
  | 'vra_analysis'
  | 'compactness_calculation'
  | 'h3_alignment'
  | 'expert_report_generation';

export interface JobData {
  type: JobType;
  userId: string;
  caseId?: string;
  params: Record<string, unknown>;
}

export interface JobProgress {
  jobId: string;
  progress: number;
  status: string;
  message?: string;
  result?: unknown;
}

// ============================================
// Error Types
// ============================================

export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(service: string, details?: unknown) {
    super('SERVICE_UNAVAILABLE', `${service} is currently unavailable`, 503, details);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================
// Utility Types
// ============================================

export type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

export type CamelToSnake<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${CamelToSnake<U>}`
  : S;
