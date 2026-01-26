/**
 * Democracy Litigation Plugin - TypeScript Type System
 *
 * Complete type definitions for the Democracy Litigation platform.
 * Supports all 20 use cases from the research paper.
 *
 * NO SHORTCUTS - Production-grade types only.
 */

// ============================================================================
// CASE TYPES
// ============================================================================

export type CaseType =
  | 'redistricting'
  | 'voter_id'
  | 'ballot_access'
  | 'voter_purges'
  | 'direct_democracy'
  | 'poll_closures'
  | 'drop_box_restrictions'
  | 'early_voting'
  | 'absentee_voting'

export type CaseStatus =
  | 'active'
  | 'settled'
  | 'dismissed'
  | 'won'
  | 'lost'
  | 'on_hold'
  | 'appeal'
  | 'remanded'

export type CasePhase =
  | 'discovery'
  | 'motion_practice'
  | 'trial_prep'
  | 'trial'
  | 'appeal'
  | 'remedy'
  | 'implementation'
  | 'monitoring'

export interface Party {
  name: string
  type: 'individual' | 'organization' | 'government_entity'
  organization?: string
  role?: string
}

export interface Attorney {
  name: string
  firm: string
  role: 'lead_counsel' | 'co_counsel' | 'local_counsel' | 'pro_bono'
  bar_number?: string
  email?: string
  phone?: string
}

export interface CaseMetadata {
  schematicCount?: number
  layoutCount?: number
  simulationCount?: number
  firmwareCount?: number
  judgeAssigned?: string
  courtDivision?: string
  relatedCases?: string[]
  mediaAttention?: 'low' | 'medium' | 'high'
  publicInterest?: 'low' | 'medium' | 'high'
  strategicImportance?: 'low' | 'medium' | 'high' | 'critical'
  estimatedTrialDate?: string
  estimatedCost?: number
  fundingSource?: string
  [key: string]: unknown
}

export interface DLCase {
  id: string
  userId: string
  tenantId?: string

  // Case Identification
  name: string
  caseNumber?: string
  courtName: string
  jurisdiction: string
  filingDate?: string

  // Case Classification
  caseType: CaseType
  legalClaims: string[]
  status: CaseStatus
  phase: CasePhase

  // Parties
  plaintiffs: Party[]
  defendants: Party[]
  counsel: Attorney[]
  opposingCounsel: Attorney[]

  // Metrics
  documentCount: number
  researchItems: number
  expertReports: number
  completionPercent: number

  // Metadata
  tags: string[]
  description?: string
  notes?: string
  metadata: CaseMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export type DocumentType =
  | 'expert_report'
  | 'legislative_record'
  | 'court_filing'
  | 'discovery'
  | 'deposition'
  | 'voter_file'
  | 'census_data'
  | 'election_results'
  | 'demographic_analysis'
  | 'statistical_analysis'
  | 'map_exhibit'
  | 'trial_exhibit'

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExtractedEntities {
  people?: string[]
  organizations?: string[]
  locations?: string[]
  dates?: string[]
  legalTerms?: string[]
  statutes?: string[]
  cases?: string[]
  [key: string]: string[] | undefined
}

export interface DocumentMetadata {
  pageCount?: number
  ocrConfidence?: number
  language?: string
  hasImages?: boolean
  hasTables?: boolean
  hasCharts?: boolean
  extractionMethod?: 'ocr' | 'native_pdf' | 'api'
  processingDuration?: number
  [key: string]: unknown
}

export interface DLDocument {
  id: string
  caseId: string
  userId: string

  // File Information
  filename: string
  filePath: string
  fileSize: number
  mimeType: string

  // Classification
  docType?: DocumentType
  docSubtype?: string

  // Processing Status
  processingStatus: ProcessingStatus
  ocrStatus?: ProcessingStatus
  extractionStatus?: ProcessingStatus

  // AI Analysis
  relevanceScore?: number
  confidenceScore?: number
  privilegeDetected: boolean
  privilegeConfidence?: number

  // Extracted Content
  fullText?: string
  extractedEntities?: ExtractedEntities
  summary?: string

  // Metadata
  docDate?: string
  author?: string
  tags: string[]
  metadata: DocumentMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// ============================================================================
// PRECEDENT TYPES (VRA Case Law)
// ============================================================================

export type GinglesIssue =
  | 'Gingles_I_Numerosity'
  | 'Gingles_I_Compactness'
  | 'Gingles_II_Cohesion'
  | 'Gingles_III_Bloc_Voting'
  | 'Senate_Factors'
  | 'Totality_of_Circumstances'

export type SenateFactor =
  | 'Factor_1_History_of_Discrimination'
  | 'Factor_2_Racially_Polarized_Voting'
  | 'Factor_3_Enhanced_Opportunities'
  | 'Factor_4_Candidate_Slating'
  | 'Factor_5_Socioeconomic_Effects'
  | 'Factor_6_Racial_Appeals'
  | 'Factor_7_Minority_Electoral_Success'
  | 'Factor_8_Government_Responsiveness'
  | 'Factor_9_Tenuousness'

export interface Holding {
  issue: string
  holding: string
  reasoning: string
  vote?: string
  dissent?: string
}

export interface PrecedentMetadata {
  docketNumber?: string
  judgesPanelNames?: string[]
  majorityOpinionAuthor?: string
  dissentAuthor?: string
  importance?: 'landmark' | 'high' | 'medium' | 'low'
  bindingIn?: string[]
  persuasiveIn?: string[]
  [key: string]: unknown
}

export interface Precedent {
  id: string

  // Case Identification
  caseName: string
  citation: string
  court: string
  decisionDate: string

  // VRA Analysis
  ginglesIssues: GinglesIssue[]
  senateFactors: SenateFactor[]
  holdings: Holding[]

  // Citation Network
  citesTo: string[]
  citedBy: string[]
  overruledBy?: string
  distinguishedBy?: string[]
  followedBy?: string[]

  // Content
  fullText?: string
  summary: string
  keyLanguage?: string

  // Metadata
  metadata: PrecedentMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ============================================================================
// GEOGRAPHIC TYPES
// ============================================================================

export type GeoType =
  | 'census_block'
  | 'precinct'
  | 'district'
  | 'county'
  | 'state'
  | 'congressional_district'
  | 'state_legislative_district'
  | 'voting_tabulation_district'

export interface ElectionResults {
  electionDate: string
  electionType: 'primary' | 'general' | 'special' | 'runoff'
  office: string
  candidates: Array<{
    name: string
    party: string
    votes: number
    votePercent: number
    isIncumbent?: boolean
    isCandidateOfChoice?: boolean
  }>
  totalVotes: number
  turnout?: number
  turnoutPercent?: number
}

export interface GeoMetadata {
  source?: string
  vintage?: string
  confidence?: number
  alignmentMethod?: string
  populationWeighted?: boolean
  [key: string]: unknown
}

export interface GeographicData {
  id: string
  caseId?: string

  // Geography Identification
  geoType: GeoType
  geoId: string
  geoName?: string

  // Spatial Data
  geometry: GeoJSON.Geometry
  centroid: GeoJSON.Point
  areaSqkm: number

  // Demographics (Census 2020)
  totalPopulation: number
  votingAgePopulation: number
  whitePopulation: number
  blackPopulation: number
  hispanicPopulation: number
  asianPopulation: number
  nativeAmericanPopulation: number
  otherPopulation: number

  // Calculated Demographics
  whitePercent?: number
  blackPercent?: number
  hispanicPercent?: number
  asianPercent?: number
  minorityPercent?: number

  // Election Data
  electionResults?: ElectionResults[]

  // H3 Hexagonal Grid
  h3Resolution7?: string
  h3Resolution9?: string
  h3Resolution11?: string

  // Compactness Metrics
  polsbyPopper?: number
  reock?: number
  convexHullRatio?: number
  schwartzberg?: number
  lengthWidthRatio?: number

  // Metadata
  metadata: GeoMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ============================================================================
// EXPERT WITNESS TYPES
// ============================================================================

export type ExpertSpecialty =
  | 'demographic_analysis'
  | 'RPV_analysis'
  | 'ecological_inference'
  | 'compactness'
  | 'legislative_history'
  | 'voting_systems'
  | 'political_science'
  | 'geography'
  | 'statistics'
  | 'data_science'

export interface CourtFinding {
  caseId?: string
  caseName: string
  court: string
  date: string
  ruling: 'accepted' | 'rejected' | 'partially_accepted' | 'daubert_excluded'
  credibilityFinding?: string
  notes?: string
}

export interface Publication {
  title: string
  journal?: string
  year: number
  url?: string
  citationCount?: number
}

export interface ExpertMetadata {
  linkedinUrl?: string
  personalWebsite?: string
  institution?: string
  yearsExperience?: number
  ratePerHour?: number
  availability?: 'available' | 'limited' | 'unavailable'
  [key: string]: unknown
}

export interface ExpertWitness {
  id: string

  // Expert Identification
  name: string
  credentials: string
  affiliation: string
  specialties: ExpertSpecialty[]

  // Track Record
  testimonyCount: number
  plaintiffsCount: number
  defendantsCount: number
  daubertChallenges: number
  daubertSuccesses: number

  // Methodology
  typicalMethods: string[]
  softwareUsed: string[]

  // Credibility
  courtFindings: CourtFinding[]

  // Content
  cvUrl?: string
  publications?: Publication[]

  // Metadata
  metadata: ExpertMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ============================================================================
// DEADLINE TYPES
// ============================================================================

export type DeadlineType =
  | 'filing'
  | 'discovery'
  | 'motion'
  | 'hearing'
  | 'trial'
  | 'appeal'
  | 'response'
  | 'expert_report'
  | 'brief'

export type DeadlineStatus =
  | 'pending'
  | 'completed'
  | 'missed'
  | 'extended'
  | 'cancelled'

export type DeadlinePriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'critical'

export interface DeadlineMetadata {
  courtOrderUrl?: string
  extensionRequested?: boolean
  extensionGranted?: boolean
  originalDeadline?: string
  [key: string]: unknown
}

export interface Deadline {
  id: string
  caseId: string
  userId: string

  // Deadline Details
  title: string
  description?: string
  deadlineDate: string
  deadlineType?: DeadlineType

  // Status
  status: DeadlineStatus
  priority: DeadlinePriority

  // Dependencies
  dependsOn: string[]
  triggers: string[]

  // Alerts
  alertIntervals: number[]
  alertsSent: string[]

  // Metadata
  courtOrderUrl?: string
  notes?: string
  metadata: DeadlineMetadata

  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// ============================================================================
// JOB TYPES (Async Operations)
// ============================================================================

export type JobType =
  | 'discovery_triage'
  | 'legislative_history'
  | 'expert_data_prep'
  | 'census_alignment'
  | 'precedent_search'
  | 'compactness_analysis'
  | 'report_generation'
  | 'document_ocr'
  | 'entity_extraction'
  | 'pattern_detection'

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface Job<T = unknown> {
  id: string
  caseId?: string
  userId: string

  // Job Details
  jobType: JobType
  status: JobStatus

  // Progress
  progress: number
  currentStep?: string
  message?: string

  // Data
  inputData?: Record<string, unknown>
  result?: T
  errorMessage?: string

  // Timing
  queuedAt: string
  startedAt?: string
  completedAt?: string

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  metadata?: {
    requestId: string
    timestamp: string
    duration: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Case Requests
export interface CreateCaseRequest {
  name: string
  caseNumber?: string
  courtName: string
  jurisdiction: string
  caseType: CaseType
  legalClaims?: string[]
  filingDate?: string
  description?: string
  tags?: string[]
  plaintiffs?: Party[]
  defendants?: Party[]
  counsel?: Attorney[]
  opposingCounsel?: Attorney[]
}

export interface UpdateCaseRequest {
  name?: string
  caseNumber?: string
  courtName?: string
  jurisdiction?: string
  status?: CaseStatus
  phase?: CasePhase
  legalClaims?: string[]
  description?: string
  notes?: string
  plaintiffs?: Party[]
  defendants?: Party[]
  counsel?: Attorney[]
  opposingCounsel?: Attorney[]
  tags?: string[]
  metadata?: Partial<CaseMetadata>
}

export interface ListCasesRequest {
  status?: CaseStatus
  caseType?: CaseType
  jurisdiction?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'createdAt' | 'filingDate' | 'completionPercent' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

// Document Requests
export interface UploadDocumentRequest {
  caseId: string
  file: File
  docType?: DocumentType
  docSubtype?: string
  tags?: string[]
}

export interface ListDocumentsRequest {
  caseId?: string
  docType?: DocumentType
  processingStatus?: ProcessingStatus
  relevanceScoreMin?: number
  privilegeDetected?: boolean
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'filename' | 'createdAt' | 'relevanceScore' | 'docDate'
  sortOrder?: 'asc' | 'desc'
}

export interface TriageDocumentsRequest {
  documentIds: string[]
  triageSettings?: {
    relevanceThreshold?: number
    privilegeThreshold?: number
    useMLModel?: boolean
  }
}

// Research Requests
export interface VRASearchRequest {
  query: string
  ginglesIssues?: GinglesIssue[]
  senateFactors?: SenateFactor[]
  circuits?: string[]
  courts?: string[]
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface CircuitComparisonRequest {
  issue: GinglesIssue
  circuits: string[]
}

export interface LegislativeHistoryRequest {
  caseId: string
  documentIds: string[]
}

// Geographic Requests
export interface CensusAlignmentRequest {
  caseId: string
  censusData: GeoJSON.FeatureCollection
  precinctData: GeoJSON.FeatureCollection
  h3Resolution: number
  alignmentMethod?: 'population_weighted' | 'area_weighted' | 'centroid'
}

export interface CompactnessRequest {
  districtIds: string[]
  metrics: Array<'polsby_popper' | 'reock' | 'convex_hull' | 'schwartzberg' | 'length_width'>
}

export interface GeoExportRequest {
  caseId: string
  format: 'R' | 'Python' | 'Stata' | 'CSV'
  dataTypes: string[]
  includeGeometry?: boolean
}

// Expert Requests
export interface ListExpertsRequest {
  specialty?: ExpertSpecialty
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'testimonyCount' | 'daubertSuccesses'
  sortOrder?: 'asc' | 'desc'
}

export interface GenerateExpertReportRequest {
  caseId: string
  templateType: string
  data: Record<string, unknown>
}

// Deadline Requests
export interface CreateDeadlineRequest {
  caseId: string
  title: string
  description?: string
  deadlineDate: string
  deadlineType?: DeadlineType
  priority?: DeadlinePriority
  dependsOn?: string[]
  alertIntervals?: number[]
}

export interface UpdateDeadlineRequest {
  title?: string
  description?: string
  deadlineDate?: string
  status?: DeadlineStatus
  priority?: DeadlinePriority
  alertIntervals?: number[]
  notes?: string
}

export interface ListDeadlinesRequest {
  caseId?: string
  status?: DeadlineStatus
  priority?: DeadlinePriority
  upcoming?: number
  page?: number
  pageSize?: number
  sortBy?: 'deadlineDate' | 'priority' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// ============================================================================
// SPECIALIZED ANALYSIS TYPES
// ============================================================================

export interface GinglesAnalysis {
  districtId: string

  // Gingles I: Numerosity & Compactness
  ginglesI: {
    minorityPopulation: number
    totalPopulation: number
    minorityPercent: number
    thresholdMet: boolean
    compactness: {
      polsbyPopper: number
      reock: number
      meetsStandard: boolean
    }
  }

  // Gingles II: Political Cohesion
  ginglesII: {
    cohesionScore: number
    cohesionMethods: string[]
    thresholdMet: boolean
    supportingEvidence: string[]
  }

  // Gingles III: Bloc Voting
  ginglesIII: {
    blocVotingScore: number
    blocVotingMethods: string[]
    thresholdMet: boolean
    elections: ElectionResults[]
  }

  // Overall
  allPreconditionsMet: boolean
  confidenceScore: number
}

export interface TriageResults {
  jobId: string
  documentsProcessed: number
  documentsRelevant: number
  documentsIrrelevant: number
  privilegeDetected: number
  averageRelevanceScore: number
  processingDuration: number
  results: Array<{
    documentId: string
    relevanceScore: number
    privilegeScore: number
    recommendation: 'review' | 'skip' | 'privilege_flag'
  }>
}

export interface CircuitComparisonResults {
  issue: GinglesIssue
  circuits: Array<{
    circuit: string
    standard: string
    keyPrecedents: Precedent[]
    favorableness: 'favorable' | 'neutral' | 'unfavorable'
    notes: string
  }>
  splitExists: boolean
  recommendation: string
}

export interface LegislativeHistoryTimeline {
  events: Array<{
    date: string
    type: 'introduction' | 'hearing' | 'amendment' | 'vote' | 'signing'
    title: string
    description: string
    participants: string[]
    document?: string
    significance: 'low' | 'medium' | 'high'
  }>
  narrative: string
  keyFindings: string[]
}

export interface PatternAnalysisResults {
  patterns: Array<{
    patternType: string
    description: string
    relatedCases: string[]
    confidence: number
    recommendation: string
  }>
  crossCaseInsights: string[]
}

export interface OpposingCounselIntelligence {
  attorney: string
  firm: string
  caseHistory: Array<{
    caseName: string
    court: string
    date: string
    outcome: 'won' | 'lost' | 'settled'
    strategy: string
  }>
  successRate: number
  commonStrategies: string[]
  weaknesses: string[]
  recommendations: string[]
}

export interface DeadlineConflict {
  deadlineId: string
  conflictsWith: string[]
  reason: string
  severity: 'low' | 'medium' | 'high'
  recommendation: string
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface ProgressState {
  percent: number
  step: string
  message: string
  estimatedTimeRemaining?: number
}

export interface FilterState {
  caseType: CaseType | 'all'
  status: CaseStatus | 'all'
  phase: CasePhase | 'all'
  jurisdiction: string | 'all'
  search: string
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCaseTypeDisplayName(type: CaseType): string {
  const names: Record<CaseType, string> = {
    redistricting: 'Redistricting',
    voter_id: 'Voter ID',
    ballot_access: 'Ballot Access',
    voter_purges: 'Voter Purges',
    direct_democracy: 'Direct Democracy',
    poll_closures: 'Poll Closures',
    drop_box_restrictions: 'Drop Box Restrictions',
    early_voting: 'Early Voting',
    absentee_voting: 'Absentee Voting'
  }
  return names[type] || type
}

export function getCaseStatusDisplayName(status: CaseStatus): string {
  const names: Record<CaseStatus, string> = {
    active: 'Active',
    settled: 'Settled',
    dismissed: 'Dismissed',
    won: 'Won',
    lost: 'Lost',
    on_hold: 'On Hold',
    appeal: 'Appeal',
    remanded: 'Remanded'
  }
  return names[status] || status
}

export function getCaseStatusColor(status: CaseStatus): string {
  const colors: Record<CaseStatus, string> = {
    active: 'blue',
    settled: 'gray',
    dismissed: 'gray',
    won: 'green',
    lost: 'red',
    on_hold: 'yellow',
    appeal: 'purple',
    remanded: 'orange'
  }
  return colors[status] || 'gray'
}

export function getCasePhaseDisplayName(phase: CasePhase): string {
  const names: Record<CasePhase, string> = {
    discovery: 'Discovery',
    motion_practice: 'Motion Practice',
    trial_prep: 'Trial Preparation',
    trial: 'Trial',
    appeal: 'Appeal',
    remedy: 'Remedy',
    implementation: 'Implementation',
    monitoring: 'Monitoring'
  }
  return names[phase] || phase
}

export function getCasePhaseNumber(phase: CasePhase): number {
  const numbers: Record<CasePhase, number> = {
    discovery: 1,
    motion_practice: 2,
    trial_prep: 3,
    trial: 4,
    appeal: 5,
    remedy: 6,
    implementation: 7,
    monitoring: 8
  }
  return numbers[phase] || 1
}

export function getDocumentTypeDisplayName(type: DocumentType): string {
  const names: Record<DocumentType, string> = {
    expert_report: 'Expert Report',
    legislative_record: 'Legislative Record',
    court_filing: 'Court Filing',
    discovery: 'Discovery Document',
    deposition: 'Deposition',
    voter_file: 'Voter File',
    census_data: 'Census Data',
    election_results: 'Election Results',
    demographic_analysis: 'Demographic Analysis',
    statistical_analysis: 'Statistical Analysis',
    map_exhibit: 'Map Exhibit',
    trial_exhibit: 'Trial Exhibit'
  }
  return names[type] || type
}

export function getProcessingStatusDisplayName(status: ProcessingStatus): string {
  const names: Record<ProcessingStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled'
  }
  return names[status] || status
}

export function getProcessingStatusColor(status: ProcessingStatus): string {
  const colors: Record<ProcessingStatus, string> = {
    pending: 'gray',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
    cancelled: 'gray'
  }
  return colors[status] || 'gray'
}

export function getDeadlinePriorityColor(priority: DeadlinePriority): string {
  const colors: Record<DeadlinePriority, string> = {
    low: 'gray',
    normal: 'blue',
    high: 'orange',
    critical: 'red'
  }
  return colors[priority] || 'gray'
}

export function getDeadlineTypeDisplayName(type: DeadlineType): string {
  const names: Record<DeadlineType, string> = {
    filing: 'Filing',
    discovery: 'Discovery',
    motion: 'Motion',
    hearing: 'Hearing',
    trial: 'Trial',
    appeal: 'Appeal',
    response: 'Response',
    expert_report: 'Expert Report',
    brief: 'Brief'
  }
  return names[type] || type
}

export function getJobTypeDisplayName(type: JobType): string {
  const names: Record<JobType, string> = {
    discovery_triage: 'Discovery Triage',
    legislative_history: 'Legislative History',
    expert_data_prep: 'Expert Data Preparation',
    census_alignment: 'Census Alignment',
    precedent_search: 'Precedent Search',
    compactness_analysis: 'Compactness Analysis',
    report_generation: 'Report Generation',
    document_ocr: 'Document OCR',
    entity_extraction: 'Entity Extraction',
    pattern_detection: 'Pattern Detection'
  }
  return names[type] || type
}

export function getExpertSpecialtyDisplayName(specialty: ExpertSpecialty): string {
  const names: Record<ExpertSpecialty, string> = {
    demographic_analysis: 'Demographic Analysis',
    RPV_analysis: 'Racially Polarized Voting Analysis',
    ecological_inference: 'Ecological Inference',
    compactness: 'Compactness Analysis',
    legislative_history: 'Legislative History',
    voting_systems: 'Voting Systems',
    political_science: 'Political Science',
    geography: 'Geography',
    statistics: 'Statistics',
    data_science: 'Data Science'
  }
  return names[specialty] || specialty
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`
}

export function calculateDaysUntil(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  return Math.ceil(diffMs / 86400000)
}

export function isDeadlineUrgent(deadline: Deadline): boolean {
  const daysUntil = calculateDaysUntil(deadline.deadlineDate)
  return daysUntil <= 7 && deadline.status === 'pending'
}

export function getGinglesIssueDisplayName(issue: GinglesIssue): string {
  const names: Record<GinglesIssue, string> = {
    Gingles_I_Numerosity: 'Gingles I: Numerosity',
    Gingles_I_Compactness: 'Gingles I: Compactness',
    Gingles_II_Cohesion: 'Gingles II: Political Cohesion',
    Gingles_III_Bloc_Voting: 'Gingles III: Bloc Voting',
    Senate_Factors: 'Senate Factors',
    Totality_of_Circumstances: 'Totality of Circumstances'
  }
  return names[issue] || issue
}

export function getGeoTypeDisplayName(type: GeoType): string {
  const names: Record<GeoType, string> = {
    census_block: 'Census Block',
    precinct: 'Precinct',
    district: 'District',
    county: 'County',
    state: 'State',
    congressional_district: 'Congressional District',
    state_legislative_district: 'State Legislative District',
    voting_tabulation_district: 'Voting Tabulation District'
  }
  return names[type] || type
}
